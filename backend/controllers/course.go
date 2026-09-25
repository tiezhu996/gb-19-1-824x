package controllers

import (
	"strconv"

	"edu-train/database"
	"edu-train/models"
	"edu-train/utils"

	"github.com/gin-gonic/gin"
)

func GetCourses(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	courseType := c.Query("type")
	status := c.Query("status")

	offset := (page - 1) * pageSize

	query := database.DB.Model(&models.Course{})

	if courseType != "" {
		query = query.Where("type = ?", courseType)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var courses []models.Course
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&courses).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	utils.Success(c, gin.H{
		"list":  courses,
		"total": total,
		"page":  page,
		"page_size": pageSize,
	})
}

func GetCourse(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var course models.Course
	if err := database.DB.First(&course, id).Error; err != nil {
		utils.NotFound(c, "课程不存在")
		return
	}

	utils.Success(c, course)
}

func CreateCourse(c *gin.Context) {
	var course models.Course
	if err := c.ShouldBindJSON(&course); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	course.Status = 1

	if err := database.DB.Create(&course).Error; err != nil {
		utils.InternalServerError(c, "创建失败")
		return
	}

	utils.Success(c, course)
}

func UpdateCourse(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var course models.Course
	if err := database.DB.First(&course, id).Error; err != nil {
		utils.NotFound(c, "课程不存在")
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	if err := database.DB.Model(&course).Updates(updates).Error; err != nil {
		utils.InternalServerError(c, "更新失败")
		return
	}

	utils.Success(c, course)
}

func DeleteCourse(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	if err := database.DB.Delete(&models.Course{}, id).Error; err != nil {
		utils.InternalServerError(c, "删除失败")
		return
	}

	utils.Success(c, nil)
}

func GetClassrooms(c *gin.Context) {
	var classrooms []models.Classroom
	if err := database.DB.Where("status = ?", 1).Find(&classrooms).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	utils.Success(c, classrooms)
}

func CreateClassroom(c *gin.Context) {
	var classroom models.Classroom
	if err := c.ShouldBindJSON(&classroom); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	classroom.Status = 1

	if err := database.DB.Create(&classroom).Error; err != nil {
		utils.InternalServerError(c, "创建失败")
		return
	}

	utils.Success(c, classroom)
}

func UpdateClassroom(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var classroom models.Classroom
	if err := database.DB.First(&classroom, id).Error; err != nil {
		utils.NotFound(c, "教室不存在")
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	if err := database.DB.Model(&classroom).Updates(updates).Error; err != nil {
		utils.InternalServerError(c, "更新失败")
		return
	}

	utils.Success(c, classroom)
}

func DeleteClassroom(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	if err := database.DB.Delete(&models.Classroom{}, id).Error; err != nil {
		utils.InternalServerError(c, "删除失败")
		return
	}

	utils.Success(c, nil)
}
