package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"edu-train/database"
	"edu-train/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type testResp struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func setupRefundTest(t *testing.T) *gin.Engine {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Student{}, &models.Course{}, &models.Payment{}, &models.Refund{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	database.DB = db

	student := models.Student{Name: "测试学员", Phone: "13800000009"}
	if err := db.Create(&student).Error; err != nil {
		t.Fatalf("seed student: %v", err)
	}
	payment := models.Payment{
		StudentID:     student.ID,
		Amount:        1000,
		PaymentMethod: "wechat",
		PaymentDate:   "2026-09-25",
		Type:          "tuition",
		Status:        models.PaymentStatusPaid,
		ReceiptNo:     "R-TEST-001",
	}
	if err := db.Create(&payment).Error; err != nil {
		t.Fatalf("seed payment: %v", err)
	}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", uint(1))
		c.Next()
	})
	r.POST("/refunds", CreateRefund)
	r.GET("/refunds", GetRefunds)
	r.POST("/refunds/:id/process", ProcessRefund)
	r.GET("/payments/:id", GetPayment)
	return r
}

func doJSON(t *testing.T, r *gin.Engine, method, path string, body interface{}) (int, testResp) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var resp testResp
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response %q: %v", w.Body.String(), err)
	}
	return w.Code, resp
}

func createRefund(t *testing.T, r *gin.Engine, paymentID uint, amount float64) testResp {
	t.Helper()
	_, resp := doJSON(t, r, http.MethodPost, "/refunds", map[string]interface{}{
		"payment_id": paymentID,
		"amount":     amount,
		"reason":     "测试退费",
	})
	return resp
}

func getPayment(t *testing.T, r *gin.Engine, id uint) models.Payment {
	t.Helper()
	_, resp := doJSON(t, r, http.MethodGet, fmt.Sprintf("/payments/%d", id), nil)
	if resp.Code != 0 {
		t.Fatalf("get payment failed: %s", resp.Message)
	}
	var p models.Payment
	if err := json.Unmarshal(resp.Data, &p); err != nil {
		t.Fatalf("decode payment: %v", err)
	}
	return p
}

func TestRefundLifecycle(t *testing.T) {
	r := setupRefundTest(t)

	// 申请 400：通过，待审占用 400，可退 600
	resp := createRefund(t, r, 1, 400)
	if resp.Code != 0 {
		t.Fatalf("create refund 400 failed: %s", resp.Message)
	}
	var refund1 models.Refund
	json.Unmarshal(resp.Data, &refund1)
	if refund1.Status != models.RefundStatusPending {
		t.Fatalf("expected pending, got %s", refund1.Status)
	}

	p := getPayment(t, r, 1)
	if p.PendingRefundAmount != 400 || p.RefundableAmount != 600 || p.RefundedAmount != 0 {
		t.Fatalf("unexpected quota: pending=%v refundable=%v refunded=%v",
			p.PendingRefundAmount, p.RefundableAmount, p.RefundedAmount)
	}

	// 超额申请 700：拒绝，并说明剩余可退 600
	resp = createRefund(t, r, 1, 700)
	if resp.Code == 0 {
		t.Fatal("expected over-quota refund to be rejected")
	}
	if want := "剩余可退 600.00"; !bytes.Contains([]byte(resp.Message), []byte(want)) {
		t.Fatalf("error message should state remaining quota %q, got %q", want, resp.Message)
	}

	// 再申请 600：400 + 600 = 1000，恰好等于原额，允许
	resp = createRefund(t, r, 1, 600)
	if resp.Code != 0 {
		t.Fatalf("create refund 600 failed: %s", resp.Message)
	}
	var refund2 models.Refund
	json.Unmarshal(resp.Data, &refund2)

	// 额度已被占满，再申请 0.01 也应拒绝
	resp = createRefund(t, r, 1, 0.01)
	if resp.Code == 0 {
		t.Fatal("expected refund beyond full quota to be rejected")
	}

	// 审批通过第一笔 400：累计已退 400，缴费单变为部分退款
	_, resp = doJSON(t, r, http.MethodPost, fmt.Sprintf("/refunds/%d/process", refund1.ID), map[string]string{"status": "approved"})
	if resp.Code != 0 {
		t.Fatalf("approve refund1 failed: %s", resp.Message)
	}
	p = getPayment(t, r, 1)
	if p.RefundedAmount != 400 || p.Status != models.PaymentStatusPartialRefund {
		t.Fatalf("expected refunded=400 partial_refund, got refunded=%v status=%s", p.RefundedAmount, p.Status)
	}
	if p.RefundableAmount != 0 || p.PendingRefundAmount != 600 {
		t.Fatalf("unexpected quota after approve: refundable=%v pending=%v", p.RefundableAmount, p.PendingRefundAmount)
	}

	// 重复审批同一申请：拒绝
	_, resp = doJSON(t, r, http.MethodPost, fmt.Sprintf("/refunds/%d/process", refund1.ID), map[string]string{"status": "approved"})
	if resp.Code == 0 {
		t.Fatal("expected duplicate process to be rejected")
	}

	// 驳回第二笔 600：待审额度释放，可退恢复为 600
	_, resp = doJSON(t, r, http.MethodPost, fmt.Sprintf("/refunds/%d/process", refund2.ID), map[string]string{"status": "rejected"})
	if resp.Code != 0 {
		t.Fatalf("reject refund2 failed: %s", resp.Message)
	}
	p = getPayment(t, r, 1)
	if p.RefundableAmount != 600 || p.PendingRefundAmount != 0 || p.RefundedAmount != 400 {
		t.Fatalf("quota not released after reject: refundable=%v pending=%v refunded=%v",
			p.RefundableAmount, p.PendingRefundAmount, p.RefundedAmount)
	}

	// 驳回后仍可再次申请剩余额度 600 并审批通过，缴费单变为已退款
	resp = createRefund(t, r, 1, 600)
	if resp.Code != 0 {
		t.Fatalf("create refund after reject failed: %s", resp.Message)
	}
	var refund3 models.Refund
	json.Unmarshal(resp.Data, &refund3)
	_, resp = doJSON(t, r, http.MethodPost, fmt.Sprintf("/refunds/%d/process", refund3.ID), map[string]string{"status": "approved"})
	if resp.Code != 0 {
		t.Fatalf("approve refund3 failed: %s", resp.Message)
	}
	p = getPayment(t, r, 1)
	if p.RefundedAmount != 1000 || p.Status != models.PaymentStatusRefunded || p.RefundableAmount != 0 {
		t.Fatalf("expected fully refunded, got refunded=%v status=%s refundable=%v",
			p.RefundedAmount, p.Status, p.RefundableAmount)
	}

	// 非法审批状态
	_, resp = doJSON(t, r, http.MethodPost, fmt.Sprintf("/refunds/%d/process", refund3.ID), map[string]string{"status": "unknown"})
	if resp.Code == 0 {
		t.Fatal("expected invalid status to be rejected")
	}
}
