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
  DatePicker,
  TimePicker,
  InputNumber,
  Tag,
  Input,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  scheduleApi,
  courseApi,
  teacherApi,
  classroomApi,
  Schedule,
} from '@/services/api'

const { Title } = Typography
const { Option } = Select
const { TextArea } = Input
const { RangePicker } = TimePicker

const statusOptions = [
  { value: 'scheduled', label: '已排课', color: 'blue' },
  { value: 'completed', label: '已完成', color: 'green' },
  { value: 'cancelled', label: '已取消', color: 'red' },
]

function Schedules() {
  const [loading, setLoading] = useState(false)
  const [schedules, setSchedules] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'create' | 'edit'>('create')
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [form] = Form.useForm()

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      const res: any = await scheduleApi.list()
      setSchedules(res.list || [])
    } catch (error) {
      console.error('Fetch schedules error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOptions = async () => {
    try {
      const [coursesRes, teachersRes, classroomsRes] = await Promise.all([
        courseApi.list(),
        teacherApi.list(),
        classroomApi.list(),
      ])
      setCourses((coursesRes as any)?.list || [])
      setTeachers((teachersRes as any)?.list || [])
      setClassrooms(classroomsRes || [])
    } catch (error) {
      console.error('Fetch options error:', error)
    }
  }

  useEffect(() => {
    fetchSchedules()
    fetchOptions()
  }, [])

  const handleCreate = () => {
    setModalType('create')
    setSelectedSchedule(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (schedule: Schedule) => {
    setModalType('edit')
    setSelectedSchedule(schedule)
    form.setFieldsValue({
      ...schedule,
      date: schedule.date ? dayjs(schedule.date) : undefined,
      time: [dayjs(schedule.start_time, 'HH:mm'), dayjs(schedule.end_time, 'HH:mm')],
    })
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await scheduleApi.delete(id)
      message.success('删除成功')
      fetchSchedules()
    } catch (error) {
      console.error('Delete schedule error:', error)
    }
  }

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields()
      const data = {
        course_id: values.course_id,
        teacher_id: values.teacher_id,
        classroom_id: values.classroom_id,
        date: values.date.format('YYYY-MM-DD'),
        start_time: values.time[0].format('HH:mm'),
        end_time: values.time[1].format('HH:mm'),
        duration: values.duration,
        remarks: values.remarks,
      }

      if (modalType === 'create') {
        await scheduleApi.create(data)
        message.success('创建成功')
      } else if (selectedSchedule?.id) {
        await scheduleApi.update(selectedSchedule.id, data)
        message.success('更新成功')
      }
      setModalVisible(false)
      fetchSchedules()
    } catch (error) {
      console.error('Modal submit error:', error)
    }
  }

  const columns = [
    {
      title: '课程',
      dataIndex: ['course', 'name'],
      key: 'course',
      render: (name: string) => name || '-',
    },
    {
      title: '教师',
      dataIndex: ['teacher', 'name'],
      key: 'teacher',
      render: (name: string) => name || '-',
    },
    {
      title: '教室',
      dataIndex: ['classroom', 'name'],
      key: 'classroom',
      render: (name: string) => name || '-',
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: '时间',
      key: 'time',
      render: (_: any, record: any) =>
        `${record.start_time} - ${record.end_time}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const opt = statusOptions.find((o) => o.value === status)
        return <Tag color={opt?.color || 'default'}>{opt?.label || status}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Schedule) => (
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
        排课管理
      </Title>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增排课
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={schedules}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={modalType === 'create' ? '新增排课' : '编辑排课'}
        open={modalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="course_id"
            label="课程"
            rules={[{ required: true, message: '请选择课程' }]}
          >
            <Select placeholder="请选择课程">
              {courses.map((course) => (
                <Option key={course.id} value={course.id}>
                  {course.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="teacher_id"
            label="教师"
            rules={[{ required: true, message: '请选择教师' }]}
          >
            <Select placeholder="请选择教师">
              {teachers.map((teacher) => (
                <Option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="classroom_id"
            label="教室"
            rules={[{ required: true, message: '请选择教室' }]}
          >
            <Select placeholder="请选择教室">
              {classrooms.map((classroom) => (
                <Option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="date"
            label="日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="time"
            label="时间"
            rules={[{ required: true, message: '请选择时间' }]}
          >
            <RangePicker style={{ width: '100%' }} format="HH:mm" />
          </Form.Item>
          <Form.Item
            name="duration"
            label="时长(小时)"
            rules={[{ required: true, message: '请输入时长' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0.5} step={0.5} />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Schedules
