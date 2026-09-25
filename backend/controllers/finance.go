package controllers

import (
	"errors"
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

// errRefundValidation 退费业务校验失败（具体信息通过返回消息携带）
var errRefundValidation = errors.New("refund validation failed")

// lockForUpdate 在 MySQL 上加行锁，其他方言（如测试用 SQLite）直接忽略
func lockForUpdate(tx *gorm.DB) *gorm.DB {
	if tx.Dialector.Name() == "mysql" {
		return tx.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	return tx
}

// roundMoney 金额保留两位小数，避免浮点误差影响对账
func roundMoney(v float64) float64 {
	return math.Round(v*100) / 100
}

// derivePaymentStatus 根据已退金额推导缴费单状态
func derivePaymentStatus(amount, refunded float64) string {
	refunded = roundMoney(refunded)
	switch {
	case refunded <= 0:
		return models.PaymentStatusPaid
	case refunded >= roundMoney(amount):
		return models.PaymentStatusRefunded
	default:
		return models.PaymentStatusPartialRefund
	}
}

// pendingRefundSum 统计缴费单待审核的退费总额（审批前占用可退额度）
func pendingRefundSum(tx *gorm.DB, paymentID uint) (float64, error) {
	var sum float64
	err := tx.Model(&models.Refund{}).
		Select("COALESCE(SUM(amount), 0)").
		Where("payment_id = ? AND status = ?", paymentID, models.RefundStatusPending).
		Scan(&sum).Error
	return roundMoney(sum), err
}

// fillPaymentRefundInfo 填充缴费单的待审退费与剩余可退额度
func fillPaymentRefundInfo(payments []models.Payment) {
	if len(payments) == 0 {
		return
	}

	ids := make([]uint, 0, len(payments))
	for _, p := range payments {
		ids = append(ids, p.ID)
	}

	type refundSum struct {
		PaymentID uint
		Total     float64
	}
	var sums []refundSum
	database.DB.Model(&models.Refund{}).
		Select("payment_id, COALESCE(SUM(amount), 0) AS total").
		Where("payment_id IN ? AND status = ?", ids, models.RefundStatusPending).
		Group("payment_id").
		Scan(&sums)

	pendingMap := make(map[uint]float64, len(sums))
	for _, s := range sums {
		pendingMap[s.PaymentID] = roundMoney(s.Total)
	}

	for i := range payments {
		pending := pendingMap[payments[i].ID]
		payments[i].PendingRefundAmount = pending
		payments[i].RefundableAmount = roundMoney(payments[i].Amount - payments[i].RefundedAmount - pending)
	}
}

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

	fillPaymentRefundInfo(payments)

	utils.Success(c, gin.H{
		"list":  payments,
		"total": total,
		"page":  page,
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

	payments := []models.Payment{payment}
	fillPaymentRefundInfo(payments)

	utils.Success(c, payments[0])
}

func CreatePayment(c *gin.Context) {
	var payment models.Payment
	if err := c.ShouldBindJSON(&payment); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	payment.ReceiptNo = generateReceiptNo()
	payment.Status = models.PaymentStatusPaid

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

	// 已退金额、状态、收据号由退费流程统一维护，不允许直接修改
	delete(updates, "refunded_amount")
	delete(updates, "status")
	delete(updates, "receipt_no")

	if err := database.DB.Model(&payment).Updates(updates).Error; err != nil {
		utils.InternalServerError(c, "更新失败")
		return
	}

	// 金额变更后按已退金额重新推导缴费单状态
	database.DB.First(&payment, id)
	if status := derivePaymentStatus(payment.Amount, payment.RefundedAmount); status != payment.Status {
		database.DB.Model(&payment).Update("status", status)
		payment.Status = status
	}

	utils.Success(c, payment)
}

func DeletePayment(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	if err := database.DB.Delete(&models.Payment{}, id).Error; err != nil {
		utils.InternalServerError(c, "删除失败")
		return
	}

	utils.Success(c, nil)
}

func CreateRefund(c *gin.Context) {
	var req struct {
		PaymentID uint    `json:"payment_id" binding:"required"`
		Amount    float64 `json:"amount" binding:"required"`
		Reason    string  `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	req.Amount = roundMoney(req.Amount)
	if req.Amount <= 0 {
		utils.BadRequest(c, "退费金额必须大于0")
		return
	}

	var refund models.Refund
	var errMsg string
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// 锁定缴费单，保证“已退 + 待审 + 本次申请”的校验与写入是原子的
		var payment models.Payment
		if err := lockForUpdate(tx).First(&payment, req.PaymentID).Error; err != nil {
			return err
		}

		pending, err := pendingRefundSum(tx, payment.ID)
		if err != nil {
			return err
		}

		refundable := roundMoney(payment.Amount - payment.RefundedAmount - pending)
		if req.Amount > refundable {
			errMsg = fmt.Sprintf("退费金额超出剩余可退额度，剩余可退 %.2f 元", refundable)
			return errRefundValidation
		}

		refund = models.Refund{
			StudentID: payment.StudentID,
			PaymentID: payment.ID,
			Amount:    req.Amount,
			Reason:    req.Reason,
			Status:    models.RefundStatusPending,
		}
		return tx.Create(&refund).Error
	})

	if err != nil {
		switch {
		case errors.Is(err, errRefundValidation):
			utils.BadRequest(c, errMsg)
		case errors.Is(err, gorm.ErrRecordNotFound):
			utils.NotFound(c, "缴费记录不存在")
		default:
			utils.InternalServerError(c, "创建退费申请失败")
		}
		return
	}

	utils.Success(c, refund)
}

func GetRefunds(c *gin.Context) {
	status := c.Query("status")
	paymentID := c.Query("payment_id")
	studentID := c.Query("student_id")

	query := database.DB.Model(&models.Refund{}).
		Preload("Student").
		Preload("Payment").
		Preload("Processor")

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if paymentID != "" {
		query = query.Where("payment_id = ?", paymentID)
	}
	if studentID != "" {
		query = query.Where("student_id = ?", studentID)
	}

	var refunds []models.Refund
	if err := query.Order("created_at DESC").Find(&refunds).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	utils.Success(c, refunds)
}

func ProcessRefund(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	userID, _ := c.Get("user_id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	if req.Status != models.RefundStatusApproved && req.Status != models.RefundStatusRejected {
		utils.BadRequest(c, "无效的审批状态")
		return
	}

	var refund models.Refund
	var errMsg string
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).First(&refund, id).Error; err != nil {
			return err
		}

		if refund.Status != models.RefundStatusPending {
			errMsg = "该退费申请已处理，请勿重复操作"
			return errRefundValidation
		}

		processedBy := userID.(uint)
		refund.ProcessedBy = &processedBy
		refund.Status = req.Status

		if req.Status == models.RefundStatusApproved {
			var payment models.Payment
			if err := lockForUpdate(tx).First(&payment, refund.PaymentID).Error; err != nil {
				return err
			}

			// 审批时再次校验可退额度，防止并发审批导致超额
			refundable := roundMoney(payment.Amount - payment.RefundedAmount)
			if refund.Amount > refundable {
				errMsg = fmt.Sprintf("缴费单剩余可退额度不足，剩余可退 %.2f 元", refundable)
				return errRefundValidation
			}

			// 累计已退金额并回写缴费单状态（部分退款/已退款）
			payment.RefundedAmount = roundMoney(payment.RefundedAmount + refund.Amount)
			payment.Status = derivePaymentStatus(payment.Amount, payment.RefundedAmount)
			if err := tx.Model(&payment).Updates(map[string]interface{}{
				"refunded_amount": payment.RefundedAmount,
				"status":          payment.Status,
			}).Error; err != nil {
				return err
			}

			today := time.Now().Format("2006-01-02")
			refund.RefundDate = &today
		}
		// 驳回仅更新状态，其占用的待审额度随之释放

		return tx.Save(&refund).Error
	})

	if err != nil {
		switch {
		case errors.Is(err, errRefundValidation):
			utils.BadRequest(c, errMsg)
		case errors.Is(err, gorm.ErrRecordNotFound):
			utils.NotFound(c, "退费申请不存在")
		default:
			utils.InternalServerError(c, "处理退费失败")
		}
		return
	}

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
		Select(fmt.Sprintf("%s as period, SUM(amount - refunded_amount) as total_income, SUM(refunded_amount) as total_refund, COUNT(*) as payment_count, payment_method", groupBy)).
		Where("status IN ?", []string{models.PaymentStatusPaid, models.PaymentStatusPartialRefund, models.PaymentStatusRefunded})

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
