# 教育培训机构管理平台

一套面向教育培训机构的综合管理平台，覆盖招生获客、学员管理、课程排班、财务收费、教师绩效等核心业务场景。

## 项目主要功能

- **CRM 招生管理**：管理潜在学员线索，支持线索分配、跟进记录、状态自动流转（待联系→已试听→已报名→已流失）
- **学员管理**：学员信息、就读课程、学习进度、历史缴费、标签管理
- **课程与排课管理**：创建课程产品、教师排课、冲突检测、课表查看
- **考勤管理**：学员点名签到、课时扣费、考勤推送、课消统计
- **财务管理**：多收款方式（现金/微信/支付宝/银行转账）、收据生成、收支明细、财务报表
- **教师管理与绩效**：教师信息、课时费、月度课时量、绩效工资计算
- **数据看板**：机构运营数据总览与趋势图表

## 快速启动（Docker Compose 一键部署）

```bash
# 1. 复制环境变量配置文件
cp .env.example .env

# 2. 启动所有服务
docker compose up -d
```

## 本地开发方式

### 启动前端（frontend/）

```bash
cd frontend
npm install
npm run dev
```

### 启动后端（backend/）

```bash
cd backend
go mod download
go run main.go
```

## 访问地址

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:8005 |
| 后端 API | http://localhost:3005 |
| 数据库 | localhost:3402 |
| Redis | localhost:6405 |

默认管理员账号：

- 用户名：`admin`
- 密码：`admin123`

## 技术栈

| 分类 | 技术 |
|------|------|
| 前端框架 | React 18 |
| 前端语言 | TypeScript |
| UI 组件库 | Ant Design 5 |
| 构建工具 | Vite |
| 后端框架 | Go + Gin |
| 数据库 | MySQL 8.0 |
| ORM | GORM |
| 缓存 | Redis |
| 认证方式 | JWT |
| 图表库 | ECharts |
| 容器化 | Docker + Docker Compose |

## 项目目录结构

```
教育培训机构管理平台/
├── backend/              # 后端 Go 项目
│   ├── Dockerfile
│   ├── go.mod
│   ├── main.go
│   ├── config/         # 配置加载
│   ├── controllers/    # 业务控制器
│   ├── database/        # 数据库连接与初始化
│   ├── middleware/      # Gin 中间件
│   ├── models/          # GORM 数据模型
│   └── utils/           # 工具函数
├── frontend/             # 前端 React 项目
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── store/          # Zustand 状态管理
│       ├── components/     # 公共组件
│       ├── pages/       # 页面组件
│       ├── services/    # API 接口封装
│       ├── utils/       # 工具函数
│       └── types/       # 类型定义
├── database/            # 数据库脚本
│   └── init.sql
├── docker-compose.yml
├── .env.example
└── README.md
```

## 环境变量说明

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `JWT_SECRET` | your-secret-key-here | JWT 签名密钥 |
| `JWT_EXPIRE_HOURS` | 24 | Token 过期时间（小时） |
| `APP_PORT` | 3000 | 后端服务端口 |
| `FRONTEND_PORT` | 8005 | 前端端口 |
| `MYSQL_ROOT_PASSWORD` | root | MySQL root 密码 |
| `MYSQL_DATABASE` | edu_platform | 数据库名 |
| `MYSQL_USER` | edu | 数据库用户名 |
| `MYSQL_PASSWORD` | edu123 | 数据库密码 |
| `MYSQL_PORT` | 3402 | MySQL 映射端口 |
| `REDIS_PASSWORD` | redis123 | Redis 密码 |
| `REDIS_PORT` | 6405 | Redis 映射端口 |

## Docker 部署说明

### 端口映射

```yaml
services:
  mysql:
    - 3402:3306
  redis:
    - 6405:6379
  backend:
    - 3005:3000
  frontend:
    - 8005:80
```

### 数据卷

- `mysql_data`：MySQL 数据持久化
- `redis_data`：Redis 数据持久化

### 常见问题

**1. 容器无法启动**

检查端口是否被占用：
```bash
lsof -i :8005
lsof -i :3005
```

**2. 数据库连接失败**

- 确认 `.env` 配置是否正确
- 检查 `docker compose logs mysql` 查看数据库日志
- 等待 MySQL 初始化完成（约需 30-60 秒）

**3. 前端无法访问后端 API**

- 检查 `docker compose ps` 确认 backend 服务状态
- 查看 `docker compose logs frontend` 确认 nginx 配置

### 常用 Docker 命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs

# 停止服务
docker compose down

# 停止并删除数据卷
docker compose down -v

# 重新构建镜像
docker compose build

# 进入容器
docker compose exec backend sh
```

## License

MIT License
