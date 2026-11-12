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
- EPUB 书籍导入、阅读与生词收集
- 内置 770,611 条离线英汉词典及词形还原
- 可配置的 AI 句子解析与主动回忆练习
- 统一暗色界面与闪卡翻转、滑动交互

## iOS Release

GitHub Release 提供 **未签名的真机 IPA**，不是 App Store 或 TestFlight 分发包。
不能直接点按安装，需使用 SideStore、AltStore 等工具配合自己的 Apple 账号重新签名；
可安装设备、有效期和权限取决于重新签名时使用的证书及描述文件。

本地构建需要 macOS、Xcode 和已安装的 CocoaPods 依赖：

```bash
npm ci
cd ios && pod install && cd ..
npm run check
npm run build:ios:release
```

产物和 SHA-256 校验文件位于 `outputs/ios-release/`。
构建使用 Release 配置并内嵌 JavaScript 和离线词典，不依赖 Metro 开发服务器，
且不会将开发者签名或设备描述文件打进发布包。
