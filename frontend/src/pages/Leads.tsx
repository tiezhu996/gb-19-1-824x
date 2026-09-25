import { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Button,
  Input,
  Select,
  Modal,
  Form,
  Space,
  Tag,
  Popconfirm,
  message,
  Typography,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { leadApi, userApi, Lead } from '@/services/api'

const { Title } = Typography
const { Search } = Input
const { Option } = Select
const { TextArea } = Input

const statusOptions = [
  { value: 'pending', label: '待联系', color: 'default' },
  { value: 'trial', label: '已试听', color: 'blue' },
  { value: 'enrolled', label: '已报名', color: 'green' },
  { value: 'lost', label: '已流失', color: 'red' },
]

function Leads() {
  const [loading, setLoading] = useState(false)
  const [leads, setLeads] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [users, setUsers] = useState<any[]>([])
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'create' | 'edit' | 'followup' | 'assign'>('create')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [form] = Form.useForm()
  const [followupForm] = Form.useForm()
  const [assignForm] = Form.useForm()

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const res: any = await leadApi.list({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        status: status || undefined,
      })
      setLeads(res.list || [])
      setTotal(res.total || 0)
    } catch (error) {
      console.error('Fetch leads error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await userApi.list()
      setUsers(res || [])
    } catch (error) {
      console.error('Fetch users error:', error)
    }
  }

  useEffect(() => {
    fetchLeads()
    fetchUsers()
  }, [page, pageSize])

  const handleSearch = () => {
    setPage(1)
    fetchLeads()
  }

  const handleCreate = () => {
    setModalType('create')
    setSelectedLead(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (lead: Lead) => {
    setModalType('edit')
    setSelectedLead(lead)
    form.setFieldsValue(lead)
    setModalVisible(true)
  }

  const handleFollowup = (lead: Lead) => {
    setModalType('followup')
    setSelectedLead(lead)
    followupForm.resetFields()
    setModalVisible(true)
  }

  const handleAssign = (lead: Lead) => {
    setModalType('assign')
    setSelectedLead(lead)
    assignForm.resetFields()
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await leadApi.delete(id)
      message.success('删除成功')
      fetchLeads()
    } catch (error) {
      console.error('Delete lead error:', error)
    }
  }

  const handleConvert = async (id: number) => {
    try {
      await leadApi.convert(id)
      message.success('转换成功')
      fetchLeads()
    } catch (error) {
      console.error('Convert lead error:', error)
    }
  }

  const handleModalSubmit = async () => {
    try {
      if (modalType === 'create') {
        const values = await form.validateFields()
        await leadApi.create(values)
        message.success('创建成功')
      } else if (modalType === 'edit' && selectedLead?.id) {
        const values = await form.validateFields()
        await leadApi.update(selectedLead.id, values)
        message.success('更新成功')
      } else if (modalType === 'followup' && selectedLead?.id) {
        const values = await followupForm.validateFields()
        await leadApi.followup(selectedLead.id, values)
        message.success('跟进成功')
      } else if (modalType === 'assign' && selectedLead?.id) {
        const values = await assignForm.validateFields()
        await leadApi.assign(selectedLead.id, values)
        message.success('分配成功')
      }
      setModalVisible(false)
      fetchLeads()
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
      title: '意向课程',
      dataIndex: 'intention_course',
      key: 'intention_course',
    },
    {
      title: '来源渠道',
      dataIndex: 'source_channel',
      key: 'source_channel',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const option = statusOptions.find((o) => o.value === status)
        return (
          <Tag color={option?.color || 'default'}>
            {option?.label || status}
          </Tag>
        )
      },
    },
    {
      title: '分配给',
      dataIndex: ['assigned_user', 'name'],
      key: 'assigned_to',
      render: (name: string) => name || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Lead) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            <EditOutlined /> 编辑
          </Button>
          <Button type="link" size="small" onClick={() => handleFollowup(record)}>
            跟进
          </Button>
          <Button type="link" size="small" onClick={() => handleAssign(record)}>
            分配
          </Button>
          {record.status !== 'enrolled' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleConvert(record.id!)}
            >
              转学员
            </Button>
          )}
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
        CRM 招生管理
      </Title>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Search
              placeholder="搜索姓名/电话"
              style={{ width: 250 }}
              allowClear
              onSearch={handleSearch}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              placeholder="状态筛选"
              style={{ width: 150 }}
              allowClear
              onChange={(value) => {
                setStatus(value || '')
                setTimeout(fetchLeads, 0)
              }}
            >
              {statusOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增线索
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={leads}
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
        title={modalType === 'create' ? '新增线索' : modalType === 'edit' ? '编辑线索' : modalType === 'followup' ? '跟进记录' : '分配线索'}
        open={modalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        {modalType !== 'followup' && modalType !== 'assign' && (
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
            <Form.Item name="intention_course" label="意向课程">
              <Input placeholder="请输入意向课程" />
            </Form.Item>
            <Form.Item name="source_channel" label="来源渠道">
              <Input placeholder="请输入来源渠道" />
            </Form.Item>
            {modalType === 'edit' && (
              <Form.Item name="status" label="状态">
                <Select placeholder="请选择状态">
                  {statusOptions.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}
            <Form.Item name="remarks" label="备注">
              <TextArea rows={3} placeholder="请输入备注" />
            </Form.Item>
          </Form>
        )}

        {modalType === 'followup' && (
          <Form form={followupForm} layout="vertical">
            <Form.Item
              name="content"
              label="沟通内容"
              rules={[{ required: true, message: '请输入沟通内容' }]}
            >
              <TextArea rows={4} placeholder="请输入沟通内容" />
            </Form.Item>
            <Form.Item name="result" label="沟通结果">
              <Input placeholder="请输入沟通结果" />
            </Form.Item>
            <Form.Item name="new_status" label="更新状态">
              <Select placeholder="选择新状态">
                {statusOptions.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        )}

        {modalType === 'assign' && (
          <Form form={assignForm} layout="vertical">
            <Form.Item
              name="assigned_to"
              label="分配给"
              rules={[{ required: true, message: '请选择负责人' }]}
            >
              <Select placeholder="请选择负责人">
                {users.map((user) => (
                  <Option key={user.id} value={user.id}>
                    {user.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}

export default Leads
