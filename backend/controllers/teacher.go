package controllers

import (
	"strconv"

	"edu-train/database"
	"edu-train/models"
	"edu-train/utils"

	"github.com/gin-gonic/gin"
)

func GetTeachers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	keyword := c.Query("keyword")
	status := c.Query("status")

	offset := (page - 1) * pageSize

	query := database.DB.Model(&models.Teacher{}).Preload("User")

	if keyword != "" {
		query = query.Where("name LIKE ? OR phone LIKE ? OR subjects LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var teachers []models.Teacher
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&teachers).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	utils.Success(c, gin.H{
		"list":  teachers,
		"total": total,
		"page":  page,
		"page_size": pageSize,
	})
}

func GetTeacher(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var teacher models.Teacher
	if err := database.DB.Preload("User").First(&teacher, id).Error; err != nil {
		utils.NotFound(c, "教师不存在")
		return
	}

	utils.Success(c, teacher)
}

func CreateTeacher(c *gin.Context) {
	var teacher models.Teacher
	if err := c.ShouldBindJSON(&teacher); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	teacher.Status = 1

	if err := database.DB.Create(&teacher).Error; err != nil {
		utils.InternalServerError(c, "创建失败")
		return
	}

	utils.Success(c, teacher)
}

func UpdateTeacher(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var teacher models.Teacher
	if err := database.DB.First(&teacher, id).Error; err != nil {
		utils.NotFound(c, "教师不存在")
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	if err := database.DB.Model(&teacher).Updates(updates).Error; err != nil {
		utils.InternalServerError(c, "更新失败")
		return
	}

	utils.Success(c, teacher)
}

func DeleteTeacher(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	if err := database.DB.Delete(&models.Teacher{}, id).Error; err != nil {
		utils.InternalServerError(c, "删除失败")
		return
	}

	utils.Success(c, nil)
}

func GetTeacherPerformances(c *gin.Context) {
	teacherID := c.Query("teacher_id")
	month := c.Query("month")

	query := database.DB.Model(&models.Performance{}).Preload("Teacher")

	if teacherID != "" {
		query = query.Where("teacher_id = ?", teacherID)
	}

	if month != "" {
		query = query.Where("month = ?", month)
	}

	var performances []models.Performance
	if err := query.Order("month DESC, teacher_id ASC").Find(&performances).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	utils.Success(c, performances)
}
