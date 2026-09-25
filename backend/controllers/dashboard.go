package controllers

import (
	"time"

	"edu-train/database"
	"edu-train/models"
	"edu-train/utils"

	"github.com/gin-gonic/gin"
)

func GetDashboardStats(c *gin.Context) {
	now := time.Now()
	currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	currentMonthStartStr := currentMonthStart.Format("2006-01-02")

	var stats = make(map[string]interface{})

	var newLeadsCount int64
	database.DB.Model(&models.Lead{}).Where("created_at >= ?", currentMonthStartStr).Count(&newLeadsCount)
	stats["new_leads_count"] = newLeadsCount

	var trialCount int64
	database.DB.Model(&models.Lead{}).Where("status = ? AND created_at >= ?", "trial", currentMonthStartStr).Count(&trialCount)
	var enrolledCount int64
	database.DB.Model(&models.Lead{}).Where("status = ? AND created_at >= ?", "enrolled", currentMonthStartStr).Count(&enrolledCount)
	trialConversionRate := 0.0
	if trialCount > 0 {
		trialConversionRate = float64(enrolledCount) / float64(trialCount) * 100
	}
	stats["trial_conversion_rate"] = trialConversionRate

	var newStudentsCount int64
	database.DB.Model(&models.Student{}).Where("created_at >= ?", currentMonthStartStr).Count(&newStudentsCount)
	stats["new_students_count"] = newStudentsCount

	var totalIncome float64
	database.DB.Model(&models.Payment{}).
		Select("COALESCE(SUM(amount), 0)").
		Where("status = ? AND type = ? AND payment_date >= ?", "paid", "tuition", currentMonthStartStr).
		Scan(&totalIncome)
	stats["total_income"] = totalIncome

	var hoursConsumed int64
	database.DB.Model(&models.Attendance{}).
		Select("COALESCE(SUM(hours_consumed), 0)").
		Where("created_at >= ?", currentMonthStartStr).
		Scan(&hoursConsumed)
	stats["hours_consumed"] = hoursConsumed

	var totalStudents int64
	database.DB.Model(&models.Student{}).Count(&totalStudents)
	stats["total_students"] = totalStudents

	var activeLeadsCount int64
	database.DB.Model(&models.Lead{}).Where("status IN ?", []string{"pending", "trial"}).Count(&activeLeadsCount)
	stats["active_leads_count"] = activeLeadsCount

	var totalTeachers int64
	database.DB.Model(&models.Teacher{}).Where("status = ?", 1).Count(&totalTeachers)
	stats["total_teachers"] = totalTeachers

	var totalCourses int64
	database.DB.Model(&models.Course{}).Where("status = ?", 1).Count(&totalCourses)
	stats["total_courses"] = totalCourses

	utils.Success(c, stats)
}

func GetDashboardCharts(c *gin.Context) {
	now := time.Now()

	leadTrend := getMonthlyTrend("leads", now, 6)
	incomeTrend := getMonthlyIncomeTrend(now, 6)
	courseDistribution := getCourseDistribution()
	sourceChannelStats := getSourceChannelStats(now)

	utils.Success(c, gin.H{
		"lead_trend":           leadTrend,
		"income_trend":         incomeTrend,
		"course_distribution":  courseDistribution,
		"source_channel_stats": sourceChannelStats,
	})
}

func getMonthlyTrend(tableName string, now time.Time, months int) []map[string]interface{} {
	var result []map[string]interface{}
	return result
}

func getMonthlyIncomeTrend(now time.Time, months int) []map[string]interface{} {
	var result []map[string]interface{}
	return result
}

func getCourseDistribution() []map[string]interface{} {
	var result []map[string]interface{}
	database.DB.Model(&models.StudentCourse{}).
		Select("courses.name as name, COUNT(*) as value").
		Joins("JOIN courses ON courses.id = student_courses.course_id").
		Group("courses.id, courses.name").
		Find(&result)
	return result
}

func getSourceChannelStats(now time.Time) []map[string]interface{} {
	currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	currentMonthStartStr := currentMonthStart.Format("2006-01-02")

	var result []map[string]interface{}
	database.DB.Model(&models.Lead{}).
		Select("source_channel as name, COUNT(*) as value").
		Where("created_at >= ?", currentMonthStartStr).
		Group("source_channel").
		Find(&result)
	return result
}

func GetUsers(c *gin.Context) {
	var users []models.User
	if err := database.DB.Where("status = ?", 1).Find(&users).Error; err != nil {
		utils.InternalServerError(c, "查询失败")
		return
	}

	for i := range users {
		users[i].Password = ""
	}

	utils.Success(c, users)
}
