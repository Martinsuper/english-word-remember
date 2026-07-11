# 考研英语闪卡

跨平台记忆闪卡应用原型，基于 Expo + React Native。

## 运行

```bash
npm install
npm run start
```

## 安装到真机

先连接并授权设备，然后运行：

```bash
npm run install:android
npm run install:ios
npm run install:mobile
```

`install:mobile` 会依次构建并安装到安卓手机和 iPhone。连接多台设备时，可以通过
`ANDROID_DEVICE_ID` 或 `IOS_DEVICE_ID` 环境变量明确指定目标设备。

## 已有内容

- 首页概览
- 闪卡学习页
- 单词详情页
- 收藏夹
- 错词本
- 设置页
- 认识 / 模糊 / 不认识反馈
- 标准化 SM-2 间隔重复
- 本地存储
- 导入 / 导出本地数据

## 下一步

1. 接入真题词库
2. 加上 TTS 发音
3. 加入搜索和筛选
4. 做云同步和多端登录
