#!/bin/bash

# Weather Duck 部署脚本
# 用法: ./deploy.sh

set -e  # 遇到错误立即退出

echo "🦆 Weather Duck 部署脚本"
echo "========================"

# 配置变量
SERVER_USER="root"
SERVER_HOST="yangruoji.com"
SERVER_PATH="/usr/share/nginx/html/weather_duck"
NGINX_CONF_PATH="/etc/nginx/sites-available/yangruoji.com.conf"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步骤 1: 构建项目
echo -e "${YELLOW}📦 步骤 1: 构建项目...${NC}"
if npm run build; then
    echo -e "${GREEN}✓ 构建成功${NC}"
else
    echo -e "${RED}✗ 构建失败${NC}"
    exit 1
fi

# 步骤 2: 备份服务器上的旧文件
echo -e "${YELLOW}💾 步骤 2: 备份服务器文件...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} "
    if [ -d ${SERVER_PATH} ]; then
        cp -r ${SERVER_PATH} ${SERVER_PATH}.backup.$(date +%Y%m%d_%H%M%S)
        echo '✓ 备份完成'
    else
        echo '⚠ 目标目录不存在，跳过备份'
    fi
"

# 步骤 3: 上传构建文件
echo -e "${YELLOW}📤 步骤 3: 上传构建文件...${NC}"
if rsync -avz --delete \
    --exclude='*.backup.*' \
    --exclude='.git' \
    dist/ ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/; then
    echo -e "${GREEN}✓ 文件上传成功${NC}"
else
    echo -e "${RED}✗ 文件上传失败${NC}"
    exit 1
fi

# 步骤 4: 上传 nginx 配置
echo -e "${YELLOW}⚙️  步骤 4: 更新 nginx 配置...${NC}"
read -p "是否更新 nginx 配置? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 备份旧配置
    ssh ${SERVER_USER}@${SERVER_HOST} "
        if [ -f ${NGINX_CONF_PATH} ]; then
            cp ${NGINX_CONF_PATH} ${NGINX_CONF_PATH}.backup.$(date +%Y%m%d_%H%M%S)
        fi
    "
    
    # 上传新配置
    scp nginx.conf ${SERVER_USER}@${SERVER_HOST}:${NGINX_CONF_PATH}
    
    # 测试配置
    echo -e "${YELLOW}🔍 测试 nginx 配置...${NC}"
    if ssh ${SERVER_USER}@${SERVER_HOST} "nginx -t"; then
        echo -e "${GREEN}✓ nginx 配置正确${NC}"
    else
        echo -e "${RED}✗ nginx 配置错误${NC}"
        exit 1
    fi
    
    # 重载 nginx
    echo -e "${YELLOW}🔄 重载 nginx...${NC}"
    ssh ${SERVER_USER}@${SERVER_HOST} "nginx -s reload"
    echo -e "${GREEN}✓ nginx 已重载${NC}"
else
    echo "⏭ 跳过 nginx 配置更新"
fi

# 步骤 5: Docker nginx 处理（如果使用）
echo ""
read -p "是否使用 Docker nginx? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🐳 步骤 5: 重启 Docker nginx...${NC}"
    
    read -p "请输入 Docker 容器名称 (默认: nginx): " CONTAINER_NAME
    CONTAINER_NAME=${CONTAINER_NAME:-nginx}
    
    ssh ${SERVER_USER}@${SERVER_HOST} "
        if docker ps -a --format '{{.Names}}' | grep -q '^${CONTAINER_NAME}$'; then
            echo '🔄 重启容器: ${CONTAINER_NAME}'
            docker restart ${CONTAINER_NAME}
            echo '✓ 容器已重启'
        else
            echo '⚠ 容器 ${CONTAINER_NAME} 不存在'
        fi
    "
fi

# 步骤 6: 清理 Service Worker 缓存提示
echo ""
echo -e "${GREEN}========================${NC}"
echo -e "${GREEN}✓ 部署完成！${NC}"
echo -e "${GREEN}========================${NC}"
echo ""
echo -e "${YELLOW}📱 测试清单：${NC}"
echo "1. 访问 https://yangruoji.com/weather_duck/ 验证部署"
echo "2. 测试移动端加载（不应出现无限加载）"
echo "3. 测试离线模式（开启飞行模式）"
echo "4. 清除浏览器缓存和 Service Worker 后重新测试"
echo ""
echo -e "${YELLOW}💡 提示：${NC}"
echo "- 用户可能需要刷新页面或清除缓存才能看到更新"
echo "- Service Worker 会在后台自动更新"
echo "- 可以在浏览器开发者工具中手动注销旧的 Service Worker"
echo ""
echo -e "${YELLOW}🔗 快速测试链接：${NC}"
echo "- 生产环境: https://yangruoji.com/weather_duck/"
echo "- 清除 SW: https://yangruoji.com/weather_duck/?reset-sw"
echo ""
echo "Happy coding! 🦆"
