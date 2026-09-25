package controllers

import (
	"strconv"

	"edu-train/database"
	"edu-train/models"
	"edu-train/utils"

	"github.com/gin-gonic/gin"
)

func GetSchedules(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	date := c.Query("date")
	teacherID := c.Query("teacher_id")
	classroomID := c.Query("classroom_id")
	status := c.Query("status")

	offset := (page - 1) * pageSize

	query := database.DB.Model(&models.Schedule{}).Preload("Course").Preload("Teacher").Preload("Classroom")

	if date != "" {
		query = query.Where("date = ?", date)
	}

	if teacherID != "" {
		query = query.Where("teacher_id = ?", teacherID)
	}

	if classroomID != "" {
		query = query.Where("classroom_id = ?", classroomID)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var schedules []models.Schedule
	if err := query.Order("date ASC, start_time ASC").Offset(offset).Limit(pageSize).Find(&schedules).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	utils.Success(c, gin.H{
		"list":  schedules,
		"total": total,
		"page":  page,
		"page_size": pageSize,
	})
}

func GetSchedule(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var schedule models.Schedule
	if err := database.DB.Preload("Course").Preload("Teacher").Preload("Classroom").Preload("Attendances.Student").First(&schedule, id).Error; err != nil {
		utils.NotFound(c, "排课不存在")
		return
	}

	utils.Success(c, schedule)
}

func CreateSchedule(c *gin.Context) {
	var schedule models.Schedule
	if err := c.ShouldBindJSON(&schedule); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	if hasConflict(schedule.TeacherID, schedule.ClassroomID, schedule.Date, schedule.StartTime, schedule.EndTime, 0) {
		utils.BadRequest(c, "教师或教室时间冲突")
		return
	}

	schedule.Status = "scheduled"

	if err := database.DB.Create(&schedule).Error; err != nil {
		utils.InternalServerError(c, "创建失败")
		return
	}

	utils.Success(c, schedule)
}

func UpdateSchedule(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var schedule models.Schedule
	if err := database.DB.First(&schedule, id).Error; err != nil {
		utils.NotFound(c, "排课不存在")
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		utils.BadRequest(c, "参数错误")
		return
	}

	teacherID := schedule.TeacherID
	classroomID := schedule.ClassroomID
	date := schedule.Date
	startTime := schedule.StartTime
	endTime := schedule.EndTime

	if v, ok := updates["teacher_id"]; ok {
		teacherID = uint(v.(float64))
	}
	if v, ok := updates["classroom_id"]; ok {
		classroomID = uint(v.(float64))
	}
	if v, ok := updates["date"]; ok {
		date = v.(string)
	}
	if v, ok := updates["start_time"]; ok {
		startTime = v.(string)
	}
	if v, ok := updates["end_time"]; ok {
		endTime = v.(string)
	}

	if hasConflict(teacherID, classroomID, date, startTime, endTime, uint(id)) {
		utils.BadRequest(c, "教师或教室时间冲突")
		return
	}

	if err := database.DB.Model(&schedule).Updates(updates).Error; err != nil {
		utils.InternalServerError(c, "更新失败")
		return
	}

	utils.Success(c, schedule)
}

func DeleteSchedule(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	if err := database.DB.Delete(&models.Schedule{}, id).Error; err != nil {
		utils.InternalServerError(c, "删除失败")
		return
	}

	utils.Success(c, nil)
}

func hasConflict(teacherID, classroomID uint, date, startTime, endTime string, excludeID uint) bool {
	var count int64

	query := database.DB.Model(&models.Schedule{}).Where("date = ? AND status != ?", date, "cancelled")
	if excludeID > 0 {
		query = query.Where("id != ?", excludeID)
	}

	database.DB.Raw(
		"SELECT COUNT(*) FROM schedules WHERE date = ? AND teacher_id = ? AND id != ? AND status != ? AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))",
		date, teacherID, excludeID, "cancelled", startTime, startTime, endTime, endTime,
	).Scan(&count)

	if count > 0 {
		return true
	}

	database.DB.Raw(
		"SELECT COUNT(*) FROM schedules WHERE date = ? AND classroom_id = ? AND id != ? AND status != ? AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))",
		date, classroomID, excludeID, "cancelled", startTime, startTime, endTime, endTime,
	).Scan(&count)

	return count > 0
}
