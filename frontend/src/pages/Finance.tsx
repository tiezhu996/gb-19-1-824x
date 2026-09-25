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
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { paymentApi, studentApi, courseApi } from '@/services/api'

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

function Finance() {
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'create' | 'edit'>('create')
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [form] = Form.useForm()

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const res: any = await paymentApi.list()
      setPayments(res.list || [])
    } catch (error) {
      console.error('Fetch payments error:', error)
    } finally {
      setLoading(false)
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
      title: '金额(元)',
      dataIndex: 'amount',
      key: 'amount',
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
    </div>
  )
}

export default Finance
