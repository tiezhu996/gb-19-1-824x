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
  Alert,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { paymentApi, studentApi, courseApi, refundApi } from '@/services/api'

const { Title } = Typography
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

const paymentStatusMap: Record<string, { label: string; color: string }> = {
  paid: { label: '已支付', color: 'green' },
  partial_refund: { label: '部分退款', color: 'orange' },
  refunded: { label: '已退款', color: 'red' },
}

const refundStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
}

const formatMoney = (v?: number) => `¥${Number(v || 0).toFixed(2)}`

function Finance() {
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'create' | 'edit'>('create')
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [form] = Form.useForm()

  // 退费管理
  const [refunds, setRefunds] = useState<any[]>([])
  const [refundLoading, setRefundLoading] = useState(false)
  const [refundStatus, setRefundStatus] = useState<string>('')
  const [refundModalVisible, setRefundModalVisible] = useState(false)
  const [refundForm] = Form.useForm()
  const refundPaymentId = Form.useWatch('payment_id', refundForm)

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

  const fetchRefunds = async () => {
    try {
      setRefundLoading(true)
      const res: any = await refundApi.list(refundStatus ? { status: refundStatus } : undefined)
      setRefunds(res || [])
    } catch (error) {
      console.error('Fetch refunds error:', error)
    } finally {
      setRefundLoading(false)
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
    fetchRefunds()
  }, [refundStatus])

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

  // 发起退费申请，可从缴费记录行带入指定缴费单
  const handleRefundApply = (payment?: any) => {
    refundForm.resetFields()
    if (payment?.id) {
      refundForm.setFieldsValue({ payment_id: payment.id })
    }
    setRefundModalVisible(true)
  }

  const handleRefundSubmit = async () => {
    try {
      const values = await refundForm.validateFields()
      await refundApi.create({
        payment_id: values.payment_id,
        amount: values.amount,
        reason: values.reason,
      })
      message.success('退费申请已提交，待审批')
      setRefundModalVisible(false)
      fetchPayments()
      fetchRefunds()
    } catch (error) {
      console.error('Refund submit error:', error)
    }
  }

  const handleProcessRefund = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await refundApi.process(id, { status })
      message.success(status === 'approved' ? '已通过，退费金额已计入缴费单' : '已驳回，占用额度已释放')
      fetchPayments()
      fetchRefunds()
    } catch (error) {
      console.error('Process refund error:', error)
    }
  }

  const selectedRefundPayment = payments.find((p) => p.id === refundPaymentId)

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
      title: '原额(元)',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => formatMoney(v),
    },
    {
      title: '待审(元)',
      dataIndex: 'pending_refund_amount',
      key: 'pending_refund_amount',
      render: (v: number) => (v ? formatMoney(v) : '-'),
    },
    {
      title: '已退(元)',
      dataIndex: 'refunded_amount',
      key: 'refunded_amount',
      render: (v: number) => (v ? formatMoney(v) : '-'),
    },
    {
      title: '可退(元)',
      dataIndex: 'refundable_amount',
      key: 'refundable_amount',
      render: (v: number) => formatMoney(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const s = paymentStatusMap[status] || { label: status, color: 'default' }
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
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const opt = paymentTypes.find((o) => o.value === type)
        return opt?.label || type
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
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            <EditOutlined /> 编辑
          </Button>
          <Button
            type="link"
            size="small"
            disabled={!record.refundable_amount || record.refundable_amount <= 0}
            onClick={() => handleRefundApply(record)}
          >
            <RollbackOutlined /> 退费
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
      title: '学员',
      dataIndex: ['student', 'name'],
      key: 'student',
      render: (name: string) => name || '-',
    },
    {
      title: '收据号',
      dataIndex: ['payment', 'receipt_no'],
      key: 'receipt_no',
      render: (no: string) => no || '-',
    },
    {
      title: '缴费原额(元)',
      dataIndex: ['payment', 'amount'],
      key: 'payment_amount',
      render: (v: number) => (v != null ? formatMoney(v) : '-'),
    },
    {
      title: '退费金额(元)',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => formatMoney(v),
    },
    {
      title: '退费原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => reason || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const s = refundStatusMap[status] || { label: status, color: 'default' }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '退费日期',
      dataIndex: 'refund_date',
      key: 'refund_date',
      render: (date: string) => date || '-',
    },
    {
      title: '处理人',
      dataIndex: ['processor', 'name'],
      key: 'processor',
      render: (name: string) => name || '-',
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) =>
        record.status === 'pending' ? (
          <Space size="small">
            <Popconfirm
              title="确认通过该退费申请？"
              description="通过后将累计缴费单已退金额"
              onConfirm={() => handleProcessRefund(record.id, 'approved')}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small">
                通过
              </Button>
            </Popconfirm>
            <Popconfirm
              title="确认驳回该退费申请？"
              description="驳回后其占用的可退额度将被释放"
              onConfirm={() => handleProcessRefund(record.id, 'rejected')}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger>
                驳回
              </Button>
            </Popconfirm>
          </Space>
        ) : (
          '-'
        ),
    },
  ]

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        财务管理
      </Title>

      <Tabs
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
            label: '退费管理',
            children: (
              <Card>
                <div
                  style={{
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Select
                    style={{ width: 160 }}
                    placeholder="按状态筛选"
                    allowClear
                    value={refundStatus || undefined}
                    onChange={(v) => setRefundStatus(v || '')}
                  >
                    <Option value="pending">待审核</Option>
                    <Option value="approved">已通过</Option>
                    <Option value="rejected">已驳回</Option>
                  </Select>
                  <Button
                    type="primary"
                    icon={<RollbackOutlined />}
                    onClick={() => handleRefundApply()}
                  >
                    发起退费
                  </Button>
                </div>

                <Table
                  columns={refundColumns}
                  dataSource={refunds}
                  rowKey="id"
                  loading={refundLoading}
                  scroll={{ x: 1200 }}
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
            <Select placeholder="请选择学员">
              {students.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="course_id" label="课程">
            <Select placeholder="请选择课程">
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
        title="发起退费申请"
        open={refundModalVisible}
        onOk={handleRefundSubmit}
        onCancel={() => setRefundModalVisible(false)}
        destroyOnClose
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
              optionFilterProp="label"
              options={payments
                .filter((p) => (p.refundable_amount ?? p.amount) > 0)
                .map((p) => ({
                  value: p.id,
                  label: `${p.student?.name || '学员'}｜收据 ${p.receipt_no}｜原额 ${formatMoney(p.amount)}｜可退 ${formatMoney(p.refundable_amount ?? p.amount)}`,
                }))}
            />
          </Form.Item>

          {selectedRefundPayment && (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              showIcon
              message={
                `原额 ${formatMoney(selectedRefundPayment.amount)}｜` +
                `待审 ${formatMoney(selectedRefundPayment.pending_refund_amount)}｜` +
                `已退 ${formatMoney(selectedRefundPayment.refunded_amount)}｜` +
                `可退 ${formatMoney(selectedRefundPayment.refundable_amount)}`
              }
            />
          )}

          <Form.Item
            name="amount"
            label="退费金额(元)"
            rules={[
              { required: true, message: '请输入退费金额' },
              {
                validator: (_, value) => {
                  if (value == null) return Promise.resolve()
                  if (value <= 0) return Promise.reject(new Error('退费金额必须大于0'))
                  const max = selectedRefundPayment?.refundable_amount
                  if (max != null && value > max) {
                    return Promise.reject(new Error(`超出剩余可退额度，剩余可退 ${formatMoney(max)}`))
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              max={selectedRefundPayment?.refundable_amount}
              precision={2}
              placeholder="请输入退费金额"
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="退费原因"
            rules={[{ required: true, message: '请填写退费原因' }]}
          >
            <TextArea rows={2} placeholder="请填写退费原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Finance
