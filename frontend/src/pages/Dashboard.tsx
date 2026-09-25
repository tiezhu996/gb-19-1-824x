import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Spin, Typography } from 'antd'
import {
  TeamOutlined,
  UserAddOutlined,
  MoneyCollectOutlined,
  ClockCircleOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
  RiseOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { dashboardApi } from '@/services/api'

const { Title } = Typography

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({})
  const [chartData, setChartData] = useState<any>({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [statsData, chartsData] = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.charts(),
      ])
      setStats(statsData)
      setChartData(chartsData)
    } catch (error) {
      console.error('Fetch dashboard error:', error)
    } finally {
      setLoading(false)
    }
  }

  const coursePieOption = {
    tooltip: {
      trigger: 'item',
    },
    legend: {
      orient: 'horizontal',
      bottom: '5%',
      left: 'center',
    },
    series: [
      {
        name: '课程分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: false,
        },
        data: (chartData?.course_distribution || []).length > 0
          ? chartData.course_distribution
          : [
              { value: 10, name: '英语一对一' },
              { value: 15, name: '数学小班课' },
              { value: 8, name: '语文大班课' },
            ],
      },
    ],
  }

  const incomeBarOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月'],
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        data: [120000, 132000, 101000, 134000, 90000, 230000],
        itemStyle: {
          color: '#5470c6',
        },
      },
    ],
  }

  const leadsLineOption = {
    tooltip: {
      trigger: 'axis',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '新增线索',
        type: 'line',
        smooth: true,
        areaStyle: {},
        data: [12, 19, 15, 22, 18, 28, 25],
        itemStyle: {
          color: '#91cc75',
        },
      },
    ],
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        运营数据总览
      </Title>

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月新增线索"
              value={stats.new_leads_count || 0}
              prefix={<TeamOutlined />}
              suffix={<ArrowUpOutlined style={{ color: '#3f8600' }} />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月新增学员"
              value={stats.new_students_count || 0}
              prefix={<UserAddOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月收入(元)"
              value={stats.total_income || 0}
              precision={2}
              prefix={<MoneyCollectOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月课消课时"
              value={stats.hours_consumed || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总学员数"
              value={stats.total_students || 0}
              prefix={<UserAddOutlined />}
              suffix={<RiseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃线索数"
              value={stats.active_leads_count || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="教师总数"
              value={stats.total_teachers || 0}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="课程总数"
              value={stats.total_courses || 0}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="学员课程分布">
            <ReactECharts option={coursePieOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="月度收入趋势">
            <ReactECharts option={incomeBarOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="线索增长趋势">
            <ReactECharts option={leadsLineOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
