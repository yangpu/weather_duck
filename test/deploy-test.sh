#!/bin/bash

# 天气小鸭部署测试脚本

echo "🦆 开始部署天气小鸭应用..."

# 检查Node.js环境
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装，请先安装 npm"
    exit 1
fi

echo "✅ Node.js 环境检查通过"

# 安装依赖
echo "📦 安装依赖包..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装完成"

# 构建应用
echo "🔨 构建应用..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 应用构建失败"
    exit 1
fi

echo "✅ 应用构建完成"

# 启动本地服务器进行测试
echo "🚀 启动本地测试服务器..."
echo "📱 移动端测试页面: http://localhost:4173/test-mobile.html"
echo "🌐 主应用: http://localhost:4173/"
echo ""
echo "请在移动设备上访问以上地址进行测试"
echo "按 Ctrl+C 停止服务器"

npm run preview

echo "🦆 部署测试完成"