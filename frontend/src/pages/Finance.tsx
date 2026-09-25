import { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Button,
  Input,
  Modal,
  Form,
  Space,
  Popconfirm,
  message,
  Typography,
  Select,
  DatePicker,
  InputNumber,
  Tabs,
  Radio,
  Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TransactionOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { paymentApi, studentApi, courseApi, refundApi } from '@/services/api'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

const paymentMethods = [
  { value: 'cash', label: '现金' },
  { value: 'wechat', label: '微信' },
  { value: 'alipay', label: '支付宝' },
  { value: 'bank', label: '银行转账' },
]

const paymentTypes = [
  { value: 'tuition', label: '学费' },
  { value: 'deposit', label: '定金' },
  { value: 'other', label: '其他' },
]

const refundStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'orange' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
}

const paymentRefundStatusMap: Record<string, { label: string; color: string }> = {
  none: { label: '未退款', color: 'default' },
  partial: { label: '部分退款', color: 'gold' },
  refunded: { label: '已退款', color: 'red' },
}

const money = (v: any) => {
  const n = Number(v || 0)
  return n.toFixed(2)
}

function Finance() {
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'create' | 'edit'>('create')
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [form] = Form.useForm()

  const [activeTab, setActiveTab] = useState('payments')
  const [refunds, setRefunds] = useState<any[]>([])
  const [refundsLoading, setRefundsLoading] = useState(false)
  const [refundStatusFilter, setRefundStatusFilter] = useState<string | undefined>()
  const [refundModalVisible, setRefundModalVisible] = useState(false)
  const [refundForm] = Form.useForm()
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState<any>(null)
  const [rejectTarget, setRejectTarget] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const res: any = await paymentApi.list({ page_size: 1000 })
      setPayments(res.list || [])
    } catch (error) {
      console.error('Fetch payments error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRefunds = async (status?: string) => {
    try {
      setRefundsLoading(true)
      const res: any = await refundApi.list(status ? { status } : {})
      setRefunds(res.list || [])
    } catch (error) {
      console.error('Fetch refunds error:', error)
    } finally {
      setRefundsLoading(false)
    }
  }

  const fetchOptions = async () => {
    try {
      const [studentsRes, coursesRes] = await Promise.all([
        studentApi.list({ page_size: 1000 }),
        courseApi.list(),
      ])
      setStudents((studentsRes as any)?.list || [])
      setCourses((coursesRes as any)?.list || [])
    } catch (error) {
      console.error('Fetch options error:', error)
    }
  }

  useEffect(() => {
    fetchPayments()
    fetchOptions()
  }, [])

  useEffect(() => {
    if (activeTab === 'refunds') {
      fetchRefunds(refundStatusFilter)
    }
  }, [activeTab, refundStatusFilter])

  const handleCreate = () => {
    setModalType('create')
    setSelectedPayment(null)
    form.resetFields()
    form.setFieldsValue({
      payment_date: dayjs(),
      payment_method: 'wechat',
      type: 'tuition',
    })
    setModalVisible(true)
  }

  const handleEdit = (payment: any) => {
    setModalType('edit')
    setSelectedPayment(payment)
    form.setFieldsValue({
      ...payment,
      payment_date: payment.payment_date ? dayjs(payment.payment_date) : undefined,
    })
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await paymentApi.delete(id)
      message.success('删除成功')
      fetchPayments()
    } catch (error) {
      console.error('Delete payment error:', error)
    }
  }

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields()
      const data = {
        ...values,
        payment_date: values.payment_date.format('YYYY-MM-DD'),
      }

      if (modalType === 'create') {
        await paymentApi.create(data)
        message.success('创建成功')
      } else if (selectedPayment?.id) {
        await paymentApi.update(selectedPayment.id, data)
        message.success('更新成功')
      }
      setModalVisible(false)
      fetchPayments()
    } catch (error) {
      console.error('Modal submit error:', error)
    }
  }

  // 打开退费申请弹窗（可从缴费单行内或退费标签页发起）
  const openRefundModal = (payment?: any) => {
    setSelectedPaymentForRefund(payment || null)
    refundForm.resetFields()
    if (payment) {
      refundForm.setFieldsValue({ payment_id: payment.id })
    }
    setRefundModalVisible(true)
  }

  const handleRefundPaymentChange = (paymentId: number) => {
    const p = payments.find((item) => item.id === paymentId)
    setSelectedPaymentForRefund(p || null)
  }

  const handleRefundSubmit = async () => {
    try {
      const values = await refundForm.validateFields()
      const payment = payments.find((item) => item.id === values.payment_id)
      if (!payment) return
      const amount = Number(values.amount)
      const available = Number(payment.available_amount || 0)
      if (amount > available) {
        message.error(`退费金额不能超过剩余可退额 ${money(available)} 元`)
        return
      }
      await refundApi.create({
        payment_id: payment.id,
        student_id: payment.student_id,
        amount,
        reason: values.reason,
      })
      message.success('退费申请已提交，等待审批')
      setRefundModalVisible(false)
      fetchPayments()
      if (activeTab === 'refunds') {
        fetchRefunds(refundStatusFilter)
      }
    } catch (error) {
      console.error('Create refund error:', error)
    }
  }

  const handleApprove = async (refund: any) => {
    try {
      await refundApi.process(refund.id, { status: 'approved' })
      message.success('已审批通过，累计已退金额已更新')
      fetchPayments()
      fetchRefunds(refundStatusFilter)
    } catch (error) {
      console.error('Approve refund error:', error)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    try {
      await refundApi.process(rejectTarget.id, {
        status: 'rejected',
        reject_reason: rejectReason,
      })
      message.success('已驳回，占用的待退额度已释放')
      setRejectTarget(null)
      setRejectReason('')
      fetchPayments()
      fetchRefunds(refundStatusFilter)
    } catch (error) {
      console.error('Reject refund error:', error)
    }
  }

  const refundablePayments = payments.filter((p) => Number(p.available_amount || 0) > 0)

  const columns = [
    {
      title: '学员',
      dataIndex: ['student', 'name'],
      key: 'student',
      render: (name: string) => name || '-',
    },
    {
      title: '课程',
      dataIndex: ['course', 'name'],
      key: 'course',
      render: (name: string) => name || '-',
    },
    {
      title: '原金额(元)',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => <Text strong>{money(v)}</Text>,
    },
    {
      title: '待审(元)',
      dataIndex: 'pending_amount',
      key: 'pending_amount',
      render: (v: number) => (
        <span style={{ color: Number(v) > 0 ? '#fa8c16' : undefined }}>{money(v)}</span>
      ),
    },
    {
      title: '已退(元)',
      dataIndex: 'refunded_amount',
      key: 'refunded_amount',
      render: (v: number) => (
        <span style={{ color: Number(v) > 0 ? '#f5222d' : undefined }}>{money(v)}</span>
      ),
    },
    {
      title: '可退(元)',
      dataIndex: 'available_amount',
      key: 'available_amount',
      render: (v: number) => money(v),
    },
    {
      title: '退费状态',
      dataIndex: 'refund_status',
      key: 'refund_status',
      render: (status: string) => {
        const s = paymentRefundStatusMap[status || 'none']
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '支付方式',
      dataIndex: 'payment_method',
      key: 'payment_method',
      render: (method: string) => {
        const opt = paymentMethods.find((o) => o.value === method)
        return opt?.label || method
      },
    },
    {
      title: '日期',
      dataIndex: 'payment_date',
      key: 'payment_date',
    },
    {
      title: '收据号',
      dataIndex: 'receipt_no',
      key: 'receipt_no',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            <EditOutlined /> 编辑
          </Button>
          <Button
            type="link"
            size="small"
            disabled={Number(record.available_amount || 0) <= 0}
            onClick={() => openRefundModal(record)}
          >
            <TransactionOutlined /> 申请退费
          </Button>
          <Popconfirm
            title="确定删除?"
            onConfirm={() => handleDelete(record.id!)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>
              <DeleteOutlined /> 删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const refundColumns = [
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '学员',
      key: 'student',
      render: (_: any, record: any) =>
        record.student?.name || record.payment?.student?.name || '-',
    },
    {
      title: '缴费单',
      key: 'payment',
      render: (_: any, record: any) => {
        const p = record.payment
        if (!p) return '-'
        return (
          <div>
            <div>收据号：{p.receipt_no || '-'}</div>
            <div style={{ color: '#999' }}>{p.payment_date}</div>
          </div>
        )
      },
    },
    {
      title: '原收款(元)',
      key: 'origin_amount',
      render: (_: any, record: any) => money(record.payment?.amount),
    },
    {
      title: '申请退费(元)',
      dataIndex: 'amount',
      key: 'refund_amount',
      render: (v: number) => <Text strong type="danger">{money(v)}</Text>,
    },
    {
      title: '待审(元)',
      key: 'pending_amount',
      render: (_: any, record: any) => money(record.payment?.pending_amount),
    },
    {
      title: '已退(元)',
      key: 'refunded_amount',
      render: (_: any, record: any) => money(record.payment?.refunded_amount),
    },
    {
      title: '可退(元)',
      key: 'available_amount',
      render: (_: any, record: any) => money(record.payment?.available_amount),
    },
    {
      title: '退费原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: any) => (
        <div>
          <Tag color={refundStatusMap[status]?.color}>{refundStatusMap[status]?.label || status}</Tag>
          {status === 'rejected' && record.reject_reason && (
            <div style={{ color: '#f5222d', fontSize: 12 }}>驳回原因：{record.reject_reason}</div>
          )}
          {status === 'approved' && record.refund_date && (
            <div style={{ color: '#999', fontSize: 12 }}>退费日期：{record.refund_date}</div>
          )}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) =>
        record.status === 'pending' ? (
          <Space size="small">
            <Popconfirm
              title="确定审批通过该退费申请？"
              onConfirm={() => handleApprove(record)}
              okText="通过"
              cancelText="取消"
            >
              <Button type="link" size="small" style={{ color: '#52c41a' }}>
                通过
              </Button>
            </Popconfirm>
            <Button type="link" size="small" danger onClick={() => setRejectTarget(record)}>
              驳回
            </Button>
          </Space>
        ) : (
          <span style={{ color: '#999' }}>已处理</span>
        ),
    },
  ]

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        财务管理
      </Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'payments',
            label: '缴费记录',
            children: (
              <Card>
                <div
                  style={{
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    新增缴费
                  </Button>
                </div>

                <Table
                  columns={columns}
                  dataSource={payments}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1200 }}
                />
              </Card>
            ),
          },
          {
            key: 'refunds',
            label: '退费',
            children: (
              <Card>
                <div
                  style={{
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Space>
                    <span>状态：</span>
                    <Select
                      allowClear
                      placeholder="全部状态"
                      style={{ width: 140 }}
                      value={refundStatusFilter}
                      onChange={(v) => setRefundStatusFilter(v)}
                      options={[
                        { value: 'pending', label: '待审批' },
                        { value: 'approved', label: '已通过' },
                        { value: 'rejected', label: '已驳回' },
                      ]}
                    />
                  </Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={refundablePayments.length === 0}
                    onClick={() => openRefundModal()}
                  >
                    发起退费申请
                  </Button>
                </div>

                <Table
                  columns={refundColumns}
                  dataSource={refunds}
                  rowKey="id"
                  loading={refundsLoading}
                  scroll={{ x: 1300 }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={modalType === 'create' ? '新增缴费' : '编辑缴费'}
        open={modalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="student_id"
            label="学员"
            rules={[{ required: true, message: '请选择学员' }]}
          >
            <Select placeholder="请选择学员" showSearch optionFilterProp="children">
              {students.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="course_id" label="课程">
            <Select placeholder="请选择课程" allowClear showSearch optionFilterProp="children">
              {courses.map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="amount"
            label="金额(元)"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入金额"
            />
          </Form.Item>
          <Form.Item
            name="payment_method"
            label="支付方式"
            rules={[{ required: true, message: '请选择支付方式' }]}
          >
            <Radio.Group>
              {paymentMethods.map((m) => (
                <Radio key={m.value} value={m.value}>
                  {m.label}
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="请选择类型">
              {paymentTypes.map((t) => (
                <Option key={t.value} value={t.value}>
                  {t.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="payment_date"
            label="缴费日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="退费申请"
        open={refundModalVisible}
        onOk={handleRefundSubmit}
        onCancel={() => setRefundModalVisible(false)}
        destroyOnClose
        okText="提交申请"
      >
        <Form form={refundForm} layout="vertical">
          <Form.Item
            name="payment_id"
            label="缴费单"
            rules={[{ required: true, message: '请选择缴费单' }]}
          >
            <Select
              placeholder="请选择缴费单"
              showSearch
              optionFilterProp="children"
              onChange={handleRefundPaymentChange}
            >
              {refundablePayments.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.student?.name || '未知学员'} - {p.receipt_no}（原额 {money(p.amount)}，可退{' '}
                  {money(p.available_amount)}）
                </Option>
              ))}
            </Select>
          </Form.Item>
          {selectedPaymentForRefund && (
            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Space direction="vertical" size={2}>
                <span>原收款：<Text strong>{money(selectedPaymentForRefund.amount)}</Text> 元</span>
                <span>已退：<span style={{ color: '#f5222d' }}>{money(selectedPaymentForRefund.refunded_amount)}</span> 元</span>
                <span>待审：<span style={{ color: '#fa8c16' }}>{money(selectedPaymentForRefund.pending_amount)}</span> 元</span>
                <span>
                  剩余可退：<Text strong type="success">{money(selectedPaymentForRefund.available_amount)}</Text> 元
                </span>
              </Space>
            </Card>
          )}
          <Form.Item
            name="amount"
            label="退费金额(元)"
            rules={[
              { required: true, message: '请输入退费金额' },
              {
                validator: (_, value) => {
                  const available = Number(selectedPaymentForRefund?.available_amount || 0)
                  if (value > 0 && value <= available) return Promise.resolve()
                  return Promise.reject(new Error(`退费金额需大于0且不超过剩余可退额 ${money(available)} 元`))
                },
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              precision={2}
              max={Number(selectedPaymentForRefund?.available_amount || 0)}
              placeholder="请输入退费金额"
            />
          </Form.Item>
          <Form.Item name="reason" label="退费原因">
            <TextArea rows={3} placeholder="请说明退费原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="驳回退费申请"
        open={!!rejectTarget}
        onOk={handleReject}
        onCancel={() => {
          setRejectTarget(null)
          setRejectReason('')
        }}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <p>
          驳回后将释放该申请占用的待退额度（申请金额 {money(rejectTarget?.amount)} 元）。
        </p>
        <TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请输入驳回原因（选填）"
        />
      </Modal>
    </div>
  )
}

export default Finance
