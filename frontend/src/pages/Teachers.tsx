import { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Button,
  Modal,
  Form,
  Space,
  Popconfirm,
  message,
  Typography,
  Select,
  InputNumber,
  Input,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { teacherApi, Teacher } from '@/services/api'

const { Title } = Typography
const { Option } = Select
const { TextArea } = Input

const teacherStatuses = [
  { value: 'active', label: '在职' },
  { value: 'inactive', label: '离职' },
]

function Teachers() {
  const [loading, setLoading] = useState(false)
  const [teachers, setTeachers] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'create' | 'edit'>('create')
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [form] = Form.useForm()

  const fetchTeachers = async () => {
    try {
      setLoading(true)
      const res: any = await teacherApi.list()
      setTeachers(res.list || [])
    } catch (error) {
      console.error('Fetch teachers error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeachers()
  }, [])

  const handleCreate = () => {
    setModalType('create')
    setSelectedTeacher(null)
    form.resetFields()
    form.setFieldsValue({ status: 'active' })
    setModalVisible(true)
  }

  const handleEdit = (teacher: Teacher) => {
    setModalType('edit')
    setSelectedTeacher(teacher)
    form.setFieldsValue(teacher)
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await teacherApi.delete(id)
      message.success('删除成功')
      fetchTeachers()
    } catch (error) {
      console.error('Delete teacher error:', error)
    }
  }

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (modalType === 'create') {
        await teacherApi.create(values)
        message.success('创建成功')
      } else if (selectedTeacher?.id) {
        await teacherApi.update(selectedTeacher.id, values)
        message.success('更新成功')
      }
      setModalVisible(false)
      fetchTeachers()
    } catch (error) {
      console.error('Modal submit error:', error)
    }
  }

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '任教科目',
      dataIndex: 'subject',
      key: 'subject',
    },
    {
      title: '资质',
      dataIndex: 'qualification',
      key: 'qualification',
    },
    {
      title: '课时费(元/小时)',
      dataIndex: 'hourly_rate',
      key: 'hourly_rate',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const opt = teacherStatuses.find((o) => o.value === status)
        return opt?.label || status
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Teacher) => (
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
        教师管理
      </Title>

      <Card>
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增教师
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={teachers}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={modalType === 'create' ? '新增教师' : '编辑教师'}
        open={modalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="电话"
            rules={[{ required: true, message: '请输入电话' }]}
          >
            <Input placeholder="请输入电话" />
          </Form.Item>
          <Form.Item
            name="subject"
            label="任教科目"
            rules={[{ required: true, message: '请输入任教科目' }]}
          >
            <Input placeholder="请输入任教科目" />
          </Form.Item>
          <Form.Item name="qualification" label="资质">
            <Input placeholder="请输入资质" />
          </Form.Item>
          <Form.Item
            name="hourly_rate"
            label="课时费(元/小时)"
            rules={[{ required: true, message: '请输入课时费' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入课时费"
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态">
              {teacherStatuses.map((s) => (
                <Option key={s.value} value={s.value}>
                  {s.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Teachers
