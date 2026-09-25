import { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Button,
  Modal,
  Form,
  Space,
  message,
  Typography,
  Select,
  DatePicker,
  InputNumber,
  Input,
} from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { scheduleApi, studentApi } from '@/services/api'

const { Title } = Typography
const { Option } = Select

const attendanceStatus = [
  { value: 'present', label: '出勤' },
  { value: 'absent', label: '缺勤' },
  { value: 'late', label: '迟到' },
  { value: 'leave', label: '请假' },
]

function Attendance() {
  const [loading, setLoading] = useState(false)
  const [schedules, setSchedules] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [date, setDate] = useState<string>('')
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null)
  const [form] = Form.useForm()

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      const params: any = { status: 'scheduled' }
      if (date) {
        params.date = date
      }
      const res: any = await scheduleApi.list(params)
      setSchedules(res.list || [])
    } catch (error) {
      console.error('Fetch schedules error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    try {
      const res: any = await studentApi.list({ page_size: 1000 })
      setStudents(res.list || [])
    } catch (error) {
      console.error('Fetch students error:', error)
    }
  }

  useEffect(() => {
    fetchSchedules()
    fetchStudents()
  }, [date])

  const handleAttendance = (schedule: any) => {
    setSelectedSchedule(schedule)
    form.resetFields()
    form.setFieldsValue({
      attendances: students.map((s) => ({
        student_id: s.id,
        status: 'present',
        hours_consumed: schedule.duration || 1,
      })),
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (selectedSchedule?.id) {
        await scheduleApi.takeAttendance(selectedSchedule.id, values)
        message.success('考勤完成')
        setModalVisible(false)
        fetchSchedules()
      }
    } catch (error) {
      console.error('Attendance submit error:', error)
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
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => handleAttendance(record)}
          >
            考勤
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        考勤管理
      </Title>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <DatePicker
            style={{ width: 200 }}
            placeholder="选择日期"
            onChange={(date) => setDate(date ? date.format('YYYY-MM-DD') : '')}
          />
        </div>

        <Table
          columns={columns}
          dataSource={schedules}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title="学员考勤"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.List name="attendances">
            {(fields) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space
                    key={key}
                    style={{ display: 'flex', marginBottom: 8 }}
                    align="baseline"
                  >
                    <Form.Item
                      {...restField}
                      name={[name, 'student_id']}
                      rules={[{ required: true, message: '请选择学员' }]}
                    >
                      <Select placeholder="学员" style={{ width: 150 }}>
                        {students.map((s) => (
                          <Option key={s.id} value={s.id}>
                            {s.name}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'status']}
                      rules={[{ required: true, message: '请选择状态' }]}
                    >
                      <Select placeholder="状态" style={{ width: 100 }}>
                        {attendanceStatus.map((s) => (
                          <Option key={s.value} value={s.value}>
                            {s.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'hours_consumed']}
                    >
                      <InputNumber
                        placeholder="课时"
                        style={{ width: 80 }}
                        min={0}
                      />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'remarks']}>
                      <Input placeholder="备注" style={{ width: 150 }} />
                    </Form.Item>
                  </Space>
                ))}
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  )
}

export default Attendance
