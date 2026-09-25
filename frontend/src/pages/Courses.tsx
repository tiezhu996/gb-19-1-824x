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
  InputNumber,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { courseApi, Course } from '@/services/api'

const { Title } = Typography
const { Option } = Select
const { TextArea } = Input

const courseTypes = [
  { value: 'one_on_one', label: '一对一' },
  { value: 'small', label: '小班课' },
  { value: 'large', label: '大班课' },
]

function Courses() {
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'create' | 'edit'>('create')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [form] = Form.useForm()

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const res: any = await courseApi.list()
      setCourses(res.list || [])
    } catch (error) {
      console.error('Fetch courses error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  const handleCreate = () => {
    setModalType('create')
    setSelectedCourse(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (course: Course) => {
    setModalType('edit')
    setSelectedCourse(course)
    form.setFieldsValue(course)
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await courseApi.delete(id)
      message.success('删除成功')
      fetchCourses()
    } catch (error) {
      console.error('Delete course error:', error)
    }
  }

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (modalType === 'create') {
        await courseApi.create(values)
        message.success('创建成功')
      } else if (selectedCourse?.id) {
        await courseApi.update(selectedCourse.id, values)
        message.success('更新成功')
      }
      setModalVisible(false)
      fetchCourses()
    } catch (error) {
      console.error('Modal submit error:', error)
    }
  }

  const columns = [
    {
      title: '课程名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '课程类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const opt = courseTypes.find((o) => o.value === type)
        return opt?.label || type
      },
    },
    {
      title: '课时单价(元)',
      dataIndex: 'price_per_hour',
      key: 'price_per_hour',
    },
    {
      title: '总课时',
      dataIndex: 'total_hours',
      key: 'total_hours',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => (status === 1 ? '启用' : '禁用'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Course) => (
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
        课程管理
      </Title>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增课程
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={courses}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={modalType === 'create' ? '新增课程' : '编辑课程'}
        open={modalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="课程名称"
            rules={[{ required: true, message: '请输入课程名称' }]}
          >
            <Input placeholder="请输入课程名称" />
          </Form.Item>
          <Form.Item
            name="type"
            label="课程类型"
            rules={[{ required: true, message: '请选择课程类型' }]}
          >
            <Select placeholder="请选择课程类型">
              {courseTypes.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="price_per_hour"
            label="课时单价(元)"
            rules={[{ required: true, message: '请输入课时单价' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入课时单价"
              min={0}
              precision={2}
            />
          </Form.Item>
          <Form.Item
            name="total_hours"
            label="总课时"
            rules={[{ required: true, message: '请输入总课时' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入总课时"
              min={1}
            />
          </Form.Item>
          <Form.Item name="description" label="课程描述">
            <TextArea rows={3} placeholder="请输入课程描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Courses
