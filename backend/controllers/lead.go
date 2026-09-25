package controllers

import (
	"strconv"
	"time"

	"edu-train/database"
	"edu-train/models"
	"edu-train/utils"

	"github.com/gin-gonic/gin"
)

func GetLeads(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	status := c.Query("status")
	keyword := c.Query("keyword")
	assignedTo := c.Query("assigned_to")

	offset := (page - 1) * pageSize

	query := database.DB.Model(&models.Lead{}).Preload("AssignedUser")

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if keyword != "" {
		query = query.Where("name LIKE ? OR phone LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	if assignedTo != "" {
		query = query.Where("assigned_to = ?", assignedTo)
	}

	var total int64
	query.Count(&total)

	var leads []models.Lead
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&leads).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	utils.Success(c, gin.H{
		"list":  leads,
		"total": total,
		"page":  page,
		"page_size": pageSize,
	})
}

func GetLead(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var lead models.Lead
	if err := database.DB.Preload("AssignedUser").Preload("FollowUps.User").First(&lead, id).Error; err != nil {
		utils.NotFound(c, "线索不存在")
		return
	}

	utils.Success(c, lead)
}

func CreateLead(c *gin.Context) {
	var lead models.Lead
	if err := c.ShouldBindJSON(&lead); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	lead.Status = "pending"

	if err := database.DB.Create(&lead).Error; err != nil {
		utils.InternalServerError(c, "创建失败")
		return
	}

	utils.Success(c, lead)
}

func UpdateLead(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var lead models.Lead
	if err := database.DB.First(&lead, id).Error; err != nil {
		utils.NotFound(c, "线索不存在")
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	if err := database.DB.Model(&lead).Updates(updates).Error; err != nil {
		utils.InternalServerError(c, "更新失败")
		return
	}

	utils.Success(c, lead)
}

func DeleteLead(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	if err := database.DB.Delete(&models.Lead{}, id).Error; err != nil {
		utils.InternalServerError(c, "删除失败")
		return
	}

	utils.Success(c, nil)
}

func AssignLead(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var req struct {
		AssignedTo uint `json:"assigned_to" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	var lead models.Lead
	if err := database.DB.First(&lead, id).Error; err != nil {
		utils.NotFound(c, "线索不存在")
		return
	}

	lead.AssignedTo = &req.AssignedTo
	if err := database.DB.Save(&lead).Error; err != nil {
		utils.InternalServerError(c, "分配失败")
		return
	}

	utils.Success(c, lead)
}

func FollowUpLead(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	userID, _ := c.Get("user_id")

	var req struct {
		Content     string     `json:"content" binding:"required"`
		Result      string     `json:"result"`
		NextContact *time.Time `json:"next_contact"`
		NewStatus   string     `json:"new_status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	var lead models.Lead
	if err := database.DB.First(&lead, id).Error; err != nil {
		utils.NotFound(c, "线索不存在")
		return
	}

	followUp := models.FollowUp{
		LeadID:      uint(id),
		UserID:      userID.(uint),
		Content:     req.Content,
		Result:      req.Result,
		NextContact: req.NextContact,
	}

	if err := database.DB.Create(&followUp).Error; err != nil {
		utils.InternalServerError(c, "跟进记录失败")
		return
	}

	if req.NewStatus != "" {
		lead.Status = req.NewStatus
		database.DB.Save(&lead)
	}

	utils.Success(c, followUp)
}

func ConvertToStudent(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var lead models.Lead
	if err := database.DB.First(&lead, id).Error; err != nil {
		utils.NotFound(c, "线索不存在")
		return
	}

	leadID := lead.ID
	student := models.Student{
		Name:    lead.Name,
		Phone:   lead.Phone,
		LeadID:  &leadID,
	}

	tx := database.DB.Begin()

	if err := tx.Create(&student).Error; err != nil {
		tx.Rollback()
		utils.InternalServerError(c, "创建学员失败")
		return
	}

	lead.Status = "enrolled"
	if err := tx.Save(&lead).Error; err != nil {
		tx.Rollback()
		utils.InternalServerError(c, "更新线索状态失败")
		return
	}

	tx.Commit()
	utils.Success(c, student)
}
