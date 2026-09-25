package controllers

import (
	"fmt"
	"math"
	"strconv"
	"time"

	"edu-train/database"
	"edu-train/models"
	"edu-train/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func GetPayments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	studentID := c.Query("student_id")
	paymentMethod := c.Query("payment_method")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	typeParam := c.Query("type")

	offset := (page - 1) * pageSize

	query := database.DB.Model(&models.Payment{}).Preload("Student").Preload("Course")

	if studentID != "" {
		query = query.Where("student_id = ?", studentID)
	}

	if paymentMethod != "" {
		query = query.Where("payment_method = ?", paymentMethod)
	}

	if startDate != "" {
		query = query.Where("payment_date >= ?", startDate)
	}

	if endDate != "" {
		query = query.Where("payment_date <= ?", endDate)
	}

	if typeParam != "" {
		query = query.Where("type = ?", typeParam)
	}

	var total int64
	query.Count(&total)

	var payments []models.Payment
	if err := query.Order("payment_date DESC, created_at DESC").Offset(offset).Limit(pageSize).Find(&payments).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	fillPaymentRefundSummary(payments)

	utils.Success(c, gin.H{
		"list":      payments,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func GetPayment(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var payment models.Payment
	if err := database.DB.Preload("Student").Preload("Course").First(&payment, id).Error; err != nil {
		utils.NotFound(c, "缴费记录不存在")
		return
	}

	list := []models.Payment{payment}
	fillPaymentRefundSummary(list)

	utils.Success(c, list[0])
}

func CreatePayment(c *gin.Context) {
	var payment models.Payment
	if err := c.ShouldBindJSON(&payment); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	if payment.Amount <= 0 {
		utils.BadRequest(c, "缴费金额必须大于0")
		return
	}

	payment.ReceiptNo = generateReceiptNo()
	payment.Status = "paid"

	if payment.Type == "" {
		payment.Type = "tuition"
	}

	tx := database.DB.Begin()

	if err := tx.Create(&payment).Error; err != nil {
		tx.Rollback()
		utils.InternalServerError(c, "创建缴费记录失败")
		return
	}

	if payment.Type == "tuition" && payment.CourseID != nil {
		courseID := *payment.CourseID
		var course models.Course
		if err := tx.First(&course, courseID).Error; err == nil {
			studentCourse := models.StudentCourse{
				StudentID:  payment.StudentID,
				CourseID:   courseID,
				TotalHours: course.TotalHours,
				UsedHours:  0,
			}
			tx.Where(models.StudentCourse{StudentID: payment.StudentID, CourseID: courseID}).
				FirstOrCreate(&studentCourse)
		}
	}

	tx.Commit()
	utils.Success(c, payment)
}

func UpdatePayment(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var payment models.Payment
	if err := database.DB.First(&payment, id).Error; err != nil {
		utils.NotFound(c, "缴费记录不存在")
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	// 退费中的单据不允许直接改账，避免可退额对不上
	if amount, ok := updates["amount"].(float64); ok && amount > 0 {
		var occupied float64
		database.DB.Model(&models.Refund{}).
			Where("payment_id = ? AND status IN ?", id, []string{"pending", "approved"}).
			Select("COALESCE(SUM(amount), 0)").Scan(&occupied)
		if roundMoney(occupied) > roundMoney(amount) {
			utils.BadRequest(c, fmt.Sprintf("该缴费单已有退费/待审合计%.2f元，金额不能低于此值", occupied))
			return
		}
	}

	if err := database.DB.Model(&payment).Updates(updates).Error; err != nil {
		utils.InternalServerError(c, "更新失败")
		return
	}

	utils.Success(c, payment)
}

func DeletePayment(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var refundCount int64
	database.DB.Model(&models.Refund{}).
		Where("payment_id = ? AND status IN ?", id, []string{"pending", "approved"}).
		Count(&refundCount)
	if refundCount > 0 {
		utils.BadRequest(c, "该缴费单存在退费记录，不能删除，请先处理相关退费")
		return
	}

	if err := database.DB.Delete(&models.Payment{}, id).Error; err != nil {
		utils.InternalServerError(c, "删除失败")
		return
	}

	utils.Success(c, nil)
}

// 退费账务汇总：同一缴费单 已退 + 待审 <= 原收款
type paymentRefundTotals struct {
	Approved float64
	Pending  float64
}

func roundMoney(v float64) float64 {
	return math.Round(v*100) / 100
}

// calcRefundTotals 返回各缴费单的已退合计与待审合计；excludeRefundID 用于把当前正在提交的申请排除在外
func calcRefundTotals(tx *gorm.DB, paymentIDs []uint, excludeRefundID uint) map[uint]paymentRefundTotals {
	totals := make(map[uint]paymentRefundTotals)
	if len(paymentIDs) == 0 {
		return totals
	}

	type row struct {
		PaymentID uint
		Status    string
		Total     float64
	}
	var rows []row
	q := tx.Model(&models.Refund{}).
		Select("payment_id, status, COALESCE(SUM(amount), 0) AS total").
		Where("payment_id IN ? AND status IN ?", paymentIDs, []string{"pending", "approved"}).
		Group("payment_id, status")
	if excludeRefundID > 0 {
		q = q.Where("id <> ?", excludeRefundID)
	}
	q.Scan(&rows)

	for _, r := range rows {
		t := totals[r.PaymentID]
		if r.Status == "approved" {
			t.Approved = roundMoney(r.Total)
		} else {
			t.Pending = roundMoney(r.Total)
		}
		totals[r.PaymentID] = t
	}
	return totals
}

func fillPaymentRefundSummary(payments []models.Payment) {
	if len(payments) == 0 {
		return
	}

	ids := make([]uint, 0, len(payments))
	for _, p := range payments {
		ids = append(ids, p.ID)
	}
	totals := calcRefundTotals(database.DB, ids, 0)

	for i := range payments {
		t := totals[payments[i].ID]
		available := roundMoney(payments[i].Amount - t.Approved - t.Pending)
		if available < 0 {
			available = 0
		}
		payments[i].RefundedAmount = t.Approved
		payments[i].PendingAmount = t.Pending
		payments[i].AvailableAmount = available
		switch {
		case t.Approved > 0 && roundMoney(t.Approved) >= roundMoney(payments[i].Amount):
			payments[i].RefundStatus = "refunded"
		case t.Approved > 0:
			payments[i].RefundStatus = "partial"
		default:
			payments[i].RefundStatus = "none"
		}
	}
}

func CreateRefund(c *gin.Context) {
	var refund models.Refund
	if err := c.ShouldBindJSON(&refund); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	if refund.Amount <= 0 {
		utils.BadRequest(c, "退费金额必须大于0")
		return
	}
	if refund.PaymentID == 0 {
		utils.BadRequest(c, "请选择缴费单")
		return
	}
	refund.Amount = roundMoney(refund.Amount)

	tx := database.DB.Begin()

	// 锁定缴费单，防止并发申请重复占用额度
	var payment models.Payment
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&payment, refund.PaymentID).Error; err != nil {
		tx.Rollback()
		utils.NotFound(c, "缴费记录不存在")
		return
	}

	if refund.StudentID == 0 {
		refund.StudentID = payment.StudentID
	}

	totals := calcRefundTotals(tx, []uint{payment.ID}, 0)
	t := totals[payment.ID]
	available := roundMoney(payment.Amount - t.Approved - t.Pending)
	if refund.Amount > available {
		tx.Rollback()
		utils.BadRequest(c, fmt.Sprintf(
			"退费金额超出剩余可退额：原收款%.2f元，已退%.2f元，待审%.2f元，当前可退%.2f元",
			payment.Amount, t.Approved, t.Pending, available,
		))
		return
	}

	refund.Status = "pending"
	refund.RefundDate = nil
	refund.ProcessedBy = nil
	if err := tx.Create(&refund).Error; err != nil {
		tx.Rollback()
		utils.InternalServerError(c, "创建退费申请失败")
		return
	}

	tx.Commit()

	database.DB.Preload("Payment.Student").Preload("Student").First(&refund, refund.ID)
	utils.Success(c, refund)
}

func GetRefunds(c *gin.Context) {
	status := c.Query("status")
	paymentID := c.Query("payment_id")
	studentID := c.Query("student_id")

	query := database.DB.Model(&models.Refund{}).
		Preload("Payment").
		Preload("Student").
		Preload("Processor")

	if status != "" {
		query = query.Where("refunds.status = ?", status)
	}
	if paymentID != "" {
		query = query.Where("refunds.payment_id = ?", paymentID)
	}
	if studentID != "" {
		query = query.Where("refunds.student_id = ?", studentID)
	}

	var refunds []models.Refund
	if err := query.Order("refunds.created_at DESC").Find(&refunds).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	// 填充退费单关联缴费单的原额/待审/已退/可退汇总
	payments := make([]models.Payment, 0, len(refunds))
	paymentIdx := make(map[uint]int)
	for i := range refunds {
		if refunds[i].Payment == nil {
			continue
		}
		if _, ok := paymentIdx[refunds[i].PaymentID]; !ok {
			paymentIdx[refunds[i].PaymentID] = len(payments)
			payments = append(payments, *refunds[i].Payment)
		}
	}
	fillPaymentRefundSummary(payments)
	for i := range refunds {
		if idx, ok := paymentIdx[refunds[i].PaymentID]; ok {
			refunds[i].Payment = &payments[idx]
		}
	}

	utils.Success(c, gin.H{
		"list":  refunds,
		"total": len(refunds),
	})
}

func ProcessRefund(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	userID, _ := c.Get("user_id")

	var req struct {
		Status       string `json:"status" binding:"required"`
		RejectReason string `json:"reject_reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	if req.Status != "approved" && req.Status != "rejected" {
		utils.BadRequest(c, "审批状态只能是 approved 或 rejected")
		return
	}

	tx := database.DB.Begin()

	var refund models.Refund
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&refund, id).Error; err != nil {
		tx.Rollback()
		utils.NotFound(c, "退费申请不存在")
		return
	}

	if refund.Status != "pending" {
		tx.Rollback()
		utils.BadRequest(c, "该退费申请已处理，不能重复审批")
		return
	}

	var payment models.Payment
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&payment, refund.PaymentID).Error; err != nil {
		tx.Rollback()
		utils.NotFound(c, "缴费记录不存在")
		return
	}

	if req.Status == "approved" {
		// 审批时复核额度（排除本单自身的待审占用），累计已退不得超过原收款
		totals := calcRefundTotals(tx, []uint{payment.ID}, refund.ID)
		t := totals[payment.ID]
		available := roundMoney(payment.Amount - t.Approved)
		if roundMoney(refund.Amount) > available {
			tx.Rollback()
			utils.BadRequest(c, fmt.Sprintf(
				"可退额度不足，无法审批通过：原收款%.2f元，累计已退%.2f元，本单申请%.2f元",
				payment.Amount, t.Approved, refund.Amount,
			))
			return
		}

		today := time.Now().Format("2006-01-02")
		refund.Status = "approved"
		refund.RefundDate = &today
		refund.RejectReason = ""
	} else {
		// 驳回即释放待审占用额度
		refund.Status = "rejected"
		refund.RejectReason = req.RejectReason
	}

	uid := userID.(uint)
	refund.ProcessedBy = &uid

	if err := tx.Save(&refund).Error; err != nil {
		tx.Rollback()
		utils.InternalServerError(c, "处理退费失败")
		return
	}

	tx.Commit()

	database.DB.Preload("Payment").Preload("Student").Preload("Processor").First(&refund, refund.ID)
	utils.Success(c, refund)
}

func GetFinanceReports(c *gin.Context) {
	reportType := c.DefaultQuery("type", "daily")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var results []map[string]interface{}
	var groupBy string

	switch reportType {
	case "daily":
		groupBy = "DATE(payment_date)"
	case "monthly":
		groupBy = "SUBSTRING(payment_date, 1, 7)"
	case "yearly":
		groupBy = "SUBSTRING(payment_date, 1, 4)"
	default:
		groupBy = "DATE(payment_date)"
	}

	query := database.DB.Model(&models.Payment{}).
		Select(fmt.Sprintf("%s as period, SUM(amount) as total_income, COUNT(*) as payment_count, payment_method", groupBy)).
		Where("status = ?", "paid")

	if startDate != "" {
		query = query.Where("payment_date >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("payment_date <= ?", endDate)
	}

	if err := query.Group(groupBy + ", payment_method").Order("period DESC").Find(&results).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	utils.Success(c, results)
}

func generateReceiptNo() string {
	return fmt.Sprintf("R%s%06d", time.Now().Format("20060102150405"), time.Now().UnixNano()%1000000)
}
