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
  Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { studentApi, Student } from '@/services/api'

const { Title } = Typography
const { Search } = Input
const { TextArea } = Input

function Students() {
  const [loading, setLoading] = useState(false)
  const [students, setStudents] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'create' | 'edit'>('create')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [form] = Form.useForm()

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const res: any = await studentApi.list({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
      })
      setStudents(res.list || [])
      setTotal(res.total || 0)
    } catch (error) {
      console.error('Fetch students error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [page, pageSize])

  const handleSearch = () => {
    setPage(1)
    fetchStudents()
  }

  const handleCreate = () => {
    setModalType('create')
    setSelectedStudent(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (student: Student) => {
    setModalType('edit')
    setSelectedStudent(student)
    form.setFieldsValue(student)
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await studentApi.delete(id)
      message.success('删除成功')
      fetchStudents()
    } catch (error) {
      console.error('Delete student error:', error)
    }
  }

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (modalType === 'create') {
        await studentApi.create(values)
        message.success('创建成功')
      } else if (selectedStudent?.id) {
        await studentApi.update(selectedStudent.id, values)
        message.success('更新成功')
      }
      setModalVisible(false)
      fetchStudents()
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
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender: string) => gender || '-',
    },
    {
      title: '家长姓名',
      dataIndex: 'parent_name',
      key: 'parent_name',
      render: (name: string) => name || '-',
    },
    {
      title: '家长电话',
      dataIndex: 'parent_phone',
      key: 'parent_phone',
      render: (phone: string) => phone || '-',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string) => {
        if (!tags) return '-'
        return tags.split(',').map((tag, index) => (
          <Tag key={index}>{tag}</Tag>
        ))
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Student) => (
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
        学员管理
      </Title>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Search
            placeholder="搜索姓名/电话/家长电话"
            style={{ width: 300 }}
            allowClear
            onSearch={handleSearch}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增学员
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={students}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPage(page)
              setPageSize(pageSize)
            },
          }}
        />
      </Card>

      <Modal
        title={modalType === 'create' ? '新增学员' : '编辑学员'}
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
          <Form.Item name="gender" label="性别">
            <Input placeholder="请输入性别" />
          </Form.Item>
          <Form.Item name="parent_name" label="家长姓名">
            <Input placeholder="请输入家长姓名" />
          </Form.Item>
          <Form.Item name="parent_phone" label="家长电话">
            <Input placeholder="请输入家长电话" />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <TextArea rows={2} placeholder="请输入地址" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Input placeholder="多个标签用逗号分隔" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Students
