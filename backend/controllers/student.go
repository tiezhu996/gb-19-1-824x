package controllers

import (
	"strconv"
	"strings"

	"edu-train/database"
	"edu-train/models"
	"edu-train/utils"

	"github.com/gin-gonic/gin"
)

func GetStudents(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	keyword := c.Query("keyword")
	tag := c.Query("tag")

	offset := (page - 1) * pageSize

	query := database.DB.Model(&models.Student{})

	if keyword != "" {
		query = query.Where("name LIKE ? OR phone LIKE ? OR parent_phone LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	if tag != "" {
		query = query.Where("tags LIKE ?", "%"+tag+"%")
	}

	var total int64
	query.Count(&total)

	var students []models.Student
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&students).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	utils.Success(c, gin.H{
		"list":  students,
		"total": total,
		"page":  page,
		"page_size": pageSize,
	})
}

func GetStudent(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var student models.Student
	if err := database.DB.Preload("Payments.Course").Preload("Courses").First(&student, id).Error; err != nil {
		utils.NotFound(c, "学员不存在")
		return
	}

	for i := range student.Courses {
		student.Courses[i].RemainingHours = student.Courses[i].TotalHours - student.Courses[i].UsedHours
	}

	utils.Success(c, student)
}

func CreateStudent(c *gin.Context) {
	var student models.Student
	if err := c.ShouldBindJSON(&student); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	if err := database.DB.Create(&student).Error; err != nil {
		utils.InternalServerError(c, "创建失败")
		return
	}

	utils.Success(c, student)
}

func UpdateStudent(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var student models.Student
	if err := database.DB.First(&student, id).Error; err != nil {
		utils.NotFound(c, "学员不存在")
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	if err := database.DB.Model(&student).Updates(updates).Error; err != nil {
		utils.InternalServerError(c, "更新失败")
		return
	}

	utils.Success(c, student)
}

func DeleteStudent(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	if err := database.DB.Delete(&models.Student{}, id).Error; err != nil {
		utils.InternalServerError(c, "删除失败")
		return
	}

	utils.Success(c, nil)
}

func AddStudentTag(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var req struct {
		Tag string `json:"tag" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	var student models.Student
	if err := database.DB.First(&student, id).Error; err != nil {
		utils.NotFound(c, "学员不存在")
		return
	}

	if student.Tags == "" {
		student.Tags = req.Tag
	} else {
		student.Tags = student.Tags + "," + req.Tag
	}

	if err := database.DB.Save(&student).Error; err != nil {
		utils.InternalServerError(c, "添加标签失败")
		return
	}

	utils.Success(c, student)
}

func RemoveStudentTag(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	tag := c.Query("tag")

	if tag == "" {
		utils.BadRequest(c, "标签不能为空")
		return
	}

	var student models.Student
	if err := database.DB.First(&student, id).Error; err != nil {
		utils.NotFound(c, "学员不存在")
		return
	}

	if student.Tags != "" {
		student.Tags = splitAndRemove(student.Tags, tag)
	}

	if err := database.DB.Save(&student).Error; err != nil {
		utils.InternalServerError(c, "移除标签失败")
		return
	}

	utils.Success(c, student)
}

func splitAndRemove(tags, tagToRemove string) string {
	tagList := strings.Split(tags, ",")
	result := []string{}
	for _, t := range tagList {
		if t != tagToRemove {
			result = append(result, t)
		}
	}
	return strings.Join(result, ",")
}
