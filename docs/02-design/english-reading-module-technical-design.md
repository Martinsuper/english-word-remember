# 英语阅读模块技术设计方案

> 文档状态：Draft v1.0
> 对应 PRD：`docs/01-prd/english-reading-module.md`
> 更新日期：2026-07-12

## 1. 设计目标

本方案在现有 Expo 54、React Native 0.81、React 19 和 TypeScript 项目上增加离线 EPUB 阅读与阅读生词闭环，同时确保：

- 书籍大文件不进入 AsyncStorage 或 React 全局状态。
- EPUB 解析、存储、渲染和词汇学习边界清晰。
- 本地导入和未来在线目录共用统一领域模型。
- 内容源可替换，客户端不依赖 GitHub 仓库目录结构。
- 现有词库、学习计划、复习进度和用户工作区修改能够安全迁移。

## 2. 现状分析

### 2.1 当前技术栈

- Expo SDK 54，包含 iOS、Android 和 Web 工程。
- React Native 页面由根组件中的字符串状态切换，没有导航库。
- `useAppState` 承担加载、派生状态和大量业务 mutation。
- AsyncStorage 保存主应用状态和自定义词包。
- `jszip` 已用于解析 XLSX，可复用于 EPUB ZIP 读取。
- `expo-document-picker` 已用于本地 Excel 导入。
- `expo-speech` 已提供单词 TTS。

### 2.2 主要技术缺口

- 缺少可扩展的栈导航和深链定位。
- 缺少文件系统持久化依赖。
- 缺少 SQLite 及 schema migration。
- 缺少 WebView 和受控的章节渲染桥接。
- 当前 `Word` 只有单一来源字段，不能表达多书籍、多语境。
- AsyncStorage 单 JSON 状态不适合大量查词、进度和标注记录。
- 当前自定义词包与活跃词包切换机制不适合“阅读中随时追加”的长期词包。

## 3. 总体架构

```text
┌─────────────────────────────────────────────────────────┐
│ UI / Navigation                                         │
│ Library · Book Detail · Reader · Lookup Sheet           │
└───────────────────────┬─────────────────────────────────┘
                        │ use cases
┌───────────────────────▼─────────────────────────────────┐
│ Reading Application Layer                               │
│ importBook · openChapter · saveProgress · addReadingWord│
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
┌──────────────▼─────────────┐ ┌──────▼──────────────────┐
│ Reading Domain             │ │ Vocabulary Adapter      │
│ Book/Chapter/Locator/Source│ │ existing deck + SM-2    │
└──────────────┬─────────────┘ └──────┬──────────────────┘
               │                      │
┌──────────────▼──────────────────────▼──────────────────┐
│ Infrastructure                                         │
│ SQLite repositories · File store · EPUB parser         │
│ WebView bridge · Dictionary provider · Catalog provider│
└────────────────────────────────────────────────────────┘
```

设计约束：UI 不直接读取 EPUB ZIP；解析器不直接修改 React state；远程 catalog 不直接写学习词包。

## 4. 建议依赖

版本应使用与当前 Expo SDK 兼容的 `npx expo install` 解析结果，不在文档中锁死小版本。

| 依赖 | 用途 | 是否 MVP 必须 |
|---|---|---|
| `@react-navigation/native` | 导航容器 | 是 |
| `@react-navigation/native-stack` | 阅读详情栈 | 是 |
| `react-native-screens` | 原生导航优化 | 是 |
| `react-native-gesture-handler` | 导航/手势支持 | 是 |
| `expo-file-system` | EPUB、封面、资源与临时文件 | 是 |
| `expo-sqlite` | 书籍元数据、进度、来源和查词记录 | 是 |
| `react-native-webview` | XHTML 阅读渲染与点击选词 | 是 |
| XML 解析库 | OPF、NCX、nav 解析 | 是 |
| HTML 清洗库或白名单清洗器 | 清理脚本和危险属性 | 是 |
| `expo-crypto` | 内容哈希和重复检测 | 建议 |

继续使用：

- `jszip`：读取 EPUB ZIP 和抽取文本资源。
- `expo-document-picker`：选择 EPUB。
- `expo-speech`：发音。
- `@react-native-async-storage/async-storage`：现有设置和轻量闪卡状态。

### 4.1 XML/HTML 库选型要求

- 能在 React Native/Expo 环境运行，不依赖 Node 原生模块。
- 禁止默认执行脚本。
- XML 解析需要关闭或不支持外部实体，防止 XXE。
- HTML 清洗采用允许列表：正文标签、基础排版属性、相对资源链接。
- 在确定库之前用三类 fixture 做最小验证：EPUB 2 NCX、EPUB 3 nav、带 namespace 的 OPF。

## 5. 代码组织

建议增加：

```text
src/
├── navigation/
│   ├── AppNavigator.tsx
│   ├── MainTabs.tsx
│   ├── ReadingNavigator.tsx
│   └── types.ts
├── reading/
│   ├── domain/
│   │   ├── models.ts
│   │   ├── locator.ts
│   │   ├── wordSelection.ts
│   │   └── errors.ts
│   ├── application/
│   │   ├── importBook.ts
│   │   ├── removeBook.ts
│   │   ├── openBook.ts
│   │   ├── saveProgress.ts
│   │   └── addReadingVocabulary.ts
│   ├── infrastructure/
│   │   ├── epub/
│   │   │   ├── parseEpub.ts
│   │   │   ├── parsePackage.ts
│   │   │   ├── parseNavigation.ts
│   │   │   ├── sanitizeChapter.ts
│   │   │   └── resolveResource.ts
│   │   ├── database/
│   │   │   ├── database.ts
│   │   │   ├── migrations.ts
│   │   │   └── repositories/
│   │   ├── files/
│   │   │   └── readingFileStore.ts
│   │   ├── catalog/
│   │   │   ├── ReadingCatalogProvider.ts
│   │   │   └── StaticManifestProvider.ts
│   │   └── dictionary/
│   │       └── DictionaryProvider.ts
│   ├── presentation/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── readerBridge/
│   └── index.ts
├── screens/                 # 现有闪卡页面，逐步迁移
└── storage/                 # 现有 AsyncStorage 状态
scripts/
└── reading-catalog/
    ├── generateCatalog.ts
    └── validateCatalog.ts
```

## 6. 领域模型

### 6.1 TypeScript 模型

```ts
export type BookStatus =
  | 'importing'
  | 'ready'
  | 'failed'
  | 'deleting';

export type ReadingBook = {
  id: string;
  contentHash: string;
  title: string;
  author?: string;
  publisher?: string;
  language?: string;
  description?: string;
  coverPath?: string;
  sourceType: 'local_import' | 'remote_catalog';
  sourceRef?: string;
  originalFileName?: string;
  epubVersion?: string;
  status: BookStatus;
  fileSize: number;
  importedAt: string;
  lastOpenedAt?: string;
};

export type ReadingChapter = {
  id: string;
  bookId: string;
  spineIndex: number;
  title: string;
  href: string;
  mediaType: string;
  extractedPath: string;
  linear: boolean;
};

export type ReadingLocator = {
  chapterId: string;
  progression?: number;
  elementId?: string;
  textBefore?: string;
  textQuote?: string;
  textAfter?: string;
};

export type ReadingProgress = {
  bookId: string;
  locator: ReadingLocator;
  overallProgress: number;
  updatedAt: string;
};

export type WordContext = {
  id: string;
  normalizedTerm: string;
  surfaceForm: string;
  bookId: string;
  chapterId: string;
  locator: ReadingLocator;
  sentence: string;
  createdAt: string;
  isPrimary: boolean;
};
```

### 6.2 Locator 策略

MVP 不只保存像素偏移或章节百分比。定位信息采用混合策略：

1. `chapterId` 确定章节。
2. `elementId` 存在时优先定位稳定锚点。
3. `textQuote + textBefore + textAfter` 用于内容匹配。
4. `progression` 作为最终降级方案。

恢复顺序：元素锚点 → 文本引用匹配 → 章节相对进度 → 章节顶部。

### 6.3 词汇模型扩展

不建议直接把所有 `WordContext[]` 嵌入现有 `Word` JSON；它会使 AsyncStorage 状态持续膨胀。建议：

- 现有 `Word` 保留一个主例句用于闪卡兼容。
- 新增 `word_contexts` SQLite 表保存多语境。
- `Word` 增加可选来源类型和规范键：

```ts
type Word = {
  // existing fields...
  normalizedTerm?: string;
  origin?: 'built_in' | 'imported' | 'reading';
};
```

- `sourceBook/rawText` 在迁移期继续填充，保证现有详情页可显示。

## 7. SQLite Schema

数据库文件建议为 `reading.db`，首次版本 `user_version = 1`。

```sql
CREATE TABLE reading_books (
  id TEXT PRIMARY KEY NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  language TEXT,
  description TEXT,
  cover_path TEXT,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  original_file_name TEXT,
  epub_version TEXT,
  status TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  imported_at TEXT NOT NULL,
  last_opened_at TEXT
);

CREATE TABLE reading_chapters (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES reading_books(id) ON DELETE CASCADE,
  spine_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  href TEXT NOT NULL,
  media_type TEXT NOT NULL,
  extracted_path TEXT NOT NULL,
  linear INTEGER NOT NULL DEFAULT 1,
  UNIQUE(book_id, spine_index)
);

CREATE INDEX idx_reading_chapters_book_spine
  ON reading_chapters(book_id, spine_index);

CREATE TABLE reading_progress (
  book_id TEXT PRIMARY KEY NOT NULL REFERENCES reading_books(id) ON DELETE CASCADE,
  locator_json TEXT NOT NULL,
  overall_progress REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE word_contexts (
  id TEXT PRIMARY KEY NOT NULL,
  word_id TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  surface_form TEXT NOT NULL,
  book_id TEXT REFERENCES reading_books(id) ON DELETE SET NULL,
  chapter_id TEXT,
  locator_json TEXT NOT NULL,
  sentence TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  source_fingerprint TEXT NOT NULL UNIQUE
);

CREATE INDEX idx_word_contexts_word ON word_contexts(word_id, created_at DESC);
CREATE INDEX idx_word_contexts_book ON word_contexts(book_id);

CREATE TABLE lookup_history (
  id TEXT PRIMARY KEY NOT NULL,
  normalized_term TEXT NOT NULL,
  surface_form TEXT NOT NULL,
  book_id TEXT NOT NULL REFERENCES reading_books(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL,
  locator_json TEXT NOT NULL,
  looked_up_at TEXT NOT NULL,
  added_to_vocabulary INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_lookup_history_book_time
  ON lookup_history(book_id, looked_up_at DESC);

CREATE TABLE reading_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  font_size REAL NOT NULL,
  line_height REAL NOT NULL,
  margin_size INTEGER NOT NULL,
  theme TEXT NOT NULL,
  font_family TEXT NOT NULL,
  tap_lookup_enabled INTEGER NOT NULL
);
```

P1 增加 `bookmarks`、`highlights` 和全文索引表。

### 7.1 数据库规范

- 启用 `PRAGMA foreign_keys = ON`。
- migration 在单事务中执行，成功后再更新 `user_version`。
- repository 层统一处理 JSON 编解码和日期格式。
- UI 层不得执行原始 SQL。
- 删除书籍前先查询关联词汇和学习状态，再执行用户选择的策略。

## 8. 文件系统布局

```text
documentDirectory/reading/
├── books/
│   └── <bookId>/
│       ├── original.epub
│       ├── extracted/
│       │   └── ...
│       ├── cover.<ext>
│       └── import.json
└── temp/
    └── <importSessionId>/
```

规则：

- 导入先进入 `temp/<sessionId>`。
- 校验、解析、数据库写入全部成功后再移动至 `books/<bookId>`。
- `bookId` 使用应用生成的稳定 UUID；重复检测使用 `contentHash`。
- 不直接使用原始文件名作为目录名，避免路径穿越和特殊字符问题。
- 启动时清理超过 24 小时、且无活动会话的临时目录。
- 删除采用状态 `deleting` → 删除文件 → 删除/更新数据库；失败可重试。

### 8.1 ZIP 安全限制

导入时必须校验：

- ZIP entry 归一化后必须位于目标目录，拒绝 `../`、绝对路径和非法 scheme。
- 解压文件数量、单文件解压大小和总解压大小设上限，防止 ZIP bomb。
- 建议初始限制：压缩文件 100MB、条目 10,000、解压总量 500MB；超限可提示而非崩溃。
- `mimetype` 应为 `application/epub+zip`；兼容现实文件时允许缺失但记录警告。
- 不支持加密/DRM 资源，识别后返回明确错误码。

## 9. EPUB 导入与解析管线

```text
DocumentPicker
  → copy to temp
  → hash + duplicate check
  → JSZip open + safety validation
  → parse META-INF/container.xml
  → parse OPF metadata/manifest/spine
  → parse EPUB3 nav or EPUB2 NCX
  → extract/rewrite resources
  → sanitize chapters
  → DB transaction
  → atomic move to final directory
  → status ready
```

### 9.1 导入状态机

```text
idle → copying → validating → parsing → extracting → committing → ready
                                  └──────────────────────────→ failed
```

进度不是简单文件字节百分比，可给各阶段分配权重：复制 20%、校验 10%、解析 15%、解压/清洗 45%、提交 10%。

### 9.2 错误模型

```ts
type ReadingImportErrorCode =
  | 'FILE_UNREADABLE'
  | 'UNSUPPORTED_FORMAT'
  | 'DUPLICATE_BOOK'
  | 'INVALID_ZIP'
  | 'INVALID_CONTAINER'
  | 'INVALID_PACKAGE'
  | 'NO_READABLE_SPINE'
  | 'DRM_PROTECTED'
  | 'ZIP_SAFETY_LIMIT'
  | 'INSUFFICIENT_STORAGE'
  | 'DATABASE_FAILURE'
  | 'UNKNOWN';
```

用户界面显示可操作信息，诊断日志只记录错误码、阶段和非敏感技术信息。

### 9.3 章节处理

- 以 OPF manifest + spine 为唯一阅读顺序依据，目录只用于标题和层级。
- 将相对图片/CSS/内部章节链接解析为书籍根目录下的安全绝对路径。
- 删除 `script`、`iframe`、`object`、表单、事件属性和危险 URL。
- 外部 `http/https` 图片默认不加载；用户主动打开外链时交给系统浏览器并确认。
- 保留语义正文、标题、列表、表格、引用、脚注和基础图片。
- 为可点击文本注入最少量的自有 reader script，不修改原文件。

## 10. Reader WebView 设计

### 10.1 渲染策略

MVP 一次加载一个 spine chapter。React Native 负责章节状态和数据库，WebView 负责排版、滚动、文本命中和 locator 计算。

每章构建受控 HTML shell：

```html
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>/* app reader theme + sanitized book CSS */</style>
  </head>
  <body data-chapter-id="...">
    <!-- sanitized chapter body -->
    <script>/* bundled trusted bridge only */</script>
  </body>
</html>
```

### 10.2 消息协议

WebView → Native：

```ts
type ReaderToNativeMessage =
  | { type: 'READY'; chapterId: string; documentHeight: number }
  | { type: 'PROGRESS'; chapterId: string; locator: ReadingLocator }
  | { type: 'WORD_TAP'; requestId: string; selection: WordSelection }
  | { type: 'LINK_TAP'; href: string }
  | { type: 'READER_ERROR'; code: string; detail?: string };
```

Native → WebView：

```ts
type NativeToReaderMessage =
  | { type: 'APPLY_SETTINGS'; settings: ReaderSettings }
  | { type: 'RESTORE_LOCATOR'; locator: ReadingLocator }
  | { type: 'HIGHLIGHT_WORD'; requestId: string }
  | { type: 'CLEAR_SELECTION' };
```

要求：

- 所有消息先做运行时结构校验，不信任来自书籍文档的任意对象。
- 消息包含 schema 版本；未知类型忽略并记录开发日志。
- `WORD_TAP` 只传有限长度上下文，句子建议最多 1,000 字符。
- 进度消息在 WebView 端节流，在 Native 端防抖。

### 10.3 点击选词算法

1. 使用点击坐标获取 caret/range。
2. 按 Unicode 英文字母、内部撇号和合理连字符扩展词边界。
3. 拒绝没有拉丁字母或超过 80 字符的选择。
4. 从包含节点向外抽取句子；优先使用 `Intl.Segmenter`，缺失时用标点启发式。
5. 生成文本引用 locator。
6. Native 再执行一次规范化与长度校验。

规范化函数应位于纯 domain 模块并有表驱动单元测试。

## 11. 导航设计

建议参数类型：

```ts
type RootTabParamList = {
  Home: undefined;
  Reading: undefined;
  Plan: undefined;
  Favorites: undefined;
  Settings: undefined;
};

type ReadingStackParamList = {
  Library: undefined;
  BookDetail: { bookId: string };
  Reader: { bookId: string; locator?: ReadingLocator };
};

type VocabularyStackParamList = {
  WordDetail: { wordId: string; returnTo?: ReadingReturnTarget };
};
```

实施顺序：

1. 用导航容器包装现有页面，保持现有功能行为。
2. 将 `openWord/backScreen` 替换为 typed navigation params。
3. 加入 Reading tab 和 nested stack。
4. 为“从词卡返回原文”增加稳定路由参数。

该迁移应单独提交并通过现有测试，避免导航改造与 EPUB 解析同时调试。

## 12. 阅读状态管理

不把完整 `ReadingBook[]` 和章节内容放入现有 `AppState`。

建议提供独立 `ReadingRepository` + hooks：

```ts
interface ReadingRepository {
  listBooks(): Promise<ReadingBook[]>;
  getBook(id: string): Promise<ReadingBook | null>;
  listChapters(bookId: string): Promise<ReadingChapter[]>;
  getProgress(bookId: string): Promise<ReadingProgress | null>;
  saveProgress(progress: ReadingProgress): Promise<void>;
}
```

UI 只缓存当前列表、当前书籍、当前章节和异步状态。数据库为权威来源。若不引入第三方 server-state 库，可实现小型 context，但禁止把章节 HTML 放进 context。

## 13. 阅读生词与现有系统适配

### 13.1 固定阅读词包

新增内置逻辑词包：

```ts
const READING_PACK_ID = 'reading-vocabulary';
```

它与 JSON 内置词包不同：词条由用户逐步追加，元数据仍由现有自定义词包机制或独立 repository 持久化。

推荐增量实现：

1. 给 `AppStateApi` 增加 `upsertReadingWord(input)`。
2. 在一次 state updater 中：规范化词、查重、创建/合并词条、保留进度。
3. SQLite 事务写入 `word_contexts`。
4. 若 state 写入失败，不写 context；若 context 写入失败，返回可重试状态。

为避免跨存储原子性缺失，长期方案应把阅读词包也迁入 SQLite。MVP 可以使用幂等操作和补偿机制：

- `word_contexts.source_fingerprint` 唯一。
- 再次提交相同操作不会重复。
- 启动时检查无对应词条的 context 并标记待修复。

### 13.2 Upsert 输入与结果

```ts
type AddReadingWordInput = {
  surfaceForm: string;
  normalizedTerm: string;
  phonetic?: string;
  meaning?: string;
  sentence: string;
  bookId: string;
  chapterId: string;
  locator: ReadingLocator;
};

type AddReadingWordResult =
  | { status: 'created'; wordId: string }
  | { status: 'context_added'; wordId: string }
  | { status: 'already_exists'; wordId: string };
```

### 13.3 词条查重

- 首选 `normalizedTerm`。
- 查找当前 reading pack，然后查找当前活跃词包/其他词包用于 UI 提示。
- MVP 不合并不同词包的 review state。
- 创建的稳定 ID 使用 `reading-${slugOrHash(normalizedTerm)}`。
- 规范化算法未来升级时保存版本号，迁移时显式 remap 收藏、日志、任务和来源。

## 14. 字典接口

阅读模块依赖抽象接口：

```ts
interface DictionaryProvider {
  lookup(term: string, options?: { signal?: AbortSignal }): Promise<DictionaryEntry | null>;
}
```

MVP 实现顺序建议：

1. 优先匹配现有词库中的词条，零网络且能复用音标、释义和例句。
2. 未命中时显示“暂无本地释义”，仍可保存原词和原句。
3. 后续接入已授权的离线词典或在线 API。

查词请求使用 request ID 防止用户快速点击时旧结果覆盖新选择；在线请求设置超时和取消。

## 15. 在线目录架构（授权后）

### 15.1 Provider 抽象

```ts
interface ReadingCatalogProvider {
  fetchCatalog(options?: {
    etag?: string;
    signal?: AbortSignal;
  }): Promise<CatalogFetchResult>;
}
```

客户端只消费受控 manifest，不直接递归访问 GitHub API。

### 15.2 Manifest v1

```json
{
  "schemaVersion": 1,
  "catalogVersion": "2026-07-11.1",
  "generatedAt": "2026-07-11T16:00:00Z",
  "publications": [
    {
      "id": "economist",
      "title": "The Economist",
      "rights": {
        "distributionAllowed": true,
        "noticeUrl": "https://example.com/rights/economist"
      },
      "issues": [
        {
          "id": "economist-2026-07-11",
          "publishedAt": "2026-07-11",
          "format": "epub",
          "size": 7160725,
          "sha256": "...",
          "downloadUrl": "https://cdn.example.com/..."
        }
      ]
    }
  ]
}
```

### 15.3 生成器职责

- 扫描上游或授权内容源。
- 仅选取支持的 EPUB。
- 解析发布日期、文件大小和校验值。
- 验证 EPUB 可以打开并存在可读 spine。
- 生成 deterministic JSON 和变更摘要。
- 不满足许可配置的条目不得进入生产 manifest。
- 生产下载建议使用受控对象存储/CDN，而非 GitHub Raw。

## 16. 安全设计

威胁面包括恶意 EPUB、ZIP bomb、路径穿越、HTML 脚本、WebView 导航、XML 外部实体和超大消息。

必须措施：

- ZIP 条目路径归一化与目录边界检查。
- 解压资源数量和大小上限。
- XML 外部实体禁用。
- HTML 允许列表清洗。
- WebView 禁止任意新窗口和不受控导航。
- 默认禁止 `file://` 访问书籍目录以外路径。
- Native bridge 校验消息类型、字段、长度和 book/chapter ID。
- 外部链接必须由 Native 拦截并提示用户。
- 书籍内容不能调用应用内部任意方法。
- 错误日志不得包含正文全文。

## 17. 性能设计

### 17.1 导入

- 尽量按文件流复制，避免将整个大文件转为 base64 存入 JS 内存。
- JSZip 对大文件可能造成内存峰值；MVP 设 100MB 限制并通过真机压测。
- 按 manifest 所需资源解压，不处理未引用的超大资源。
- 导入 UI 显示阶段和取消能力；取消后清理临时目录。

### 17.2 阅读

- 一次仅加载当前章节，必要时预取下一章元数据而非完整 DOM。
- 正文 HTML 不经过 React state 反复复制。
- 进度事件 WebView 端约 250ms 节流，Native 端约 1s 防抖。
- 离开页面、App 进入后台时立即 flush 最新进度。
- 图片使用本地路径并约束最大宽度，避免超大原图撑破布局。

### 17.3 数据库

- 书库列表查询不读取章节正文。
- 为 book/spine、word/time 和 lookup/time 建索引。
- 批量导入章节使用事务。
- 长历史数据按需分页。

## 18. 兼容性与平台差异

### iOS

- Document Picker 返回安全作用域 URL 时应立即复制到私有目录。
- 配置 WebView 本地资源读取范围。
- 验证应用进入后台和内存警告时的进度保存。

### Android

- 处理 `content://` URI，不假设可直接作为普通文件路径。
- 测试 SAF 提供方、中文文件名和低存储空间。
- 后退键先关闭查词弹层，再退出阅读器。

### Web

- Web 端文件系统、SQLite 和 WebView 能力不同。
- MVP 可以通过平台 capability flag 隐藏阅读导入，或另行采用 IndexedDB + iframe 方案。
- iOS/Android 功能不得因 Web stub 缺失而无法编译。

## 19. 测试策略

### 19.1 单元测试

- 路径归一化与 ZIP Slip 拒绝。
- OPF manifest/spine 解析。
- EPUB 2 NCX 与 EPUB 3 nav 解析。
- href、fragment、百分号编码和嵌套目录解析。
- HTML 清洗规则。
- 单词边界、规范化和句子提取。
- locator 序列化、文本匹配和降级。
- 阅读生词 upsert、语境去重和进度保留。
- 数据库 migration 和 repository mapping。

### 19.2 集成测试

使用小型、可提交且授权明确的 fixtures：

- `epub2-basic.epub`
- `epub3-nav.epub`
- `nested-paths.epub`
- `missing-cover.epub`
- `malicious-path.epub`
- `script-content.epub`
- `corrupt.epub`

覆盖完整导入、重复导入、失败回滚、删除和重新导入。

### 19.3 UI/真机测试

- iOS/Android 导入不同文件来源。
- 杀进程后的进度恢复。
- 字号、旋转/尺寸变化后的定位恢复；当前产品锁定竖屏时至少测试分屏和字体缩放。
- 快速连续点词时结果不串位。
- 深色主题、图片、表格、脚注和超长章节。
- 飞行模式下完整核心流程。
- 大文件导入中的内存、耗时和取消。

### 19.4 回归测试

- 现有 `npm run typecheck`。
- 现有单元/集成测试。
- 首页、计划、收藏、设置、导入 Excel、复习和提醒。
- 旧版 AsyncStorage 数据升级后仍能打开。

## 20. 可观测性

本地结构化日志建议字段：

```ts
type ReadingLogEvent = {
  event: string;
  stage?: string;
  errorCode?: string;
  durationMs?: number;
  fileSizeBucket?: string;
  epubVersion?: string;
};
```

不得记录：完整文件名、正文、原句、用户目录路径和下载令牌。

关键事件：

- import_started/completed/failed/cancelled
- reader_opened/ready/failed
- progress_restore_succeeded/degraded/failed
- lookup_completed/failed
- reading_word_created/context_added

## 21. 迁移与发布策略

### 21.1 存储迁移

- 保持现有 `kaoyan-flashcards.app.v4` 可读。
- 新 SQLite 数据库独立初始化，不在第一版迁移现有所有词库。
- 新增 `Word` 可选字段时，旧数据 sanitizer 必须补默认值并保持兼容。
- 若修改 AppState storage version，提供 v4 → v5 迁移测试。
- 不在应用启动主线程执行 EPUB 扫描或大规模数据回填。

### 21.2 Feature flags

```ts
type FeatureFlags = {
  readingLocalImport: boolean;
  readingRemoteCatalog: boolean;
  readingAnnotations: boolean;
  readingOnlineDictionary: boolean;
};
```

- `readingLocalImport` 可随 MVP 发布。
- `readingRemoteCatalog` 默认关闭，只有授权和运行门禁通过才打开。
- Flag 关闭不删除用户本地书籍。

### 21.3 灰度顺序

1. 开发构建：内部授权 fixtures。
2. TestFlight/内部 Android：本地导入和阅读闭环。
3. 小范围 beta：验证不同来源 EPUB 兼容性。
4. 正式发布：本地导入。
5. 内容授权完成后单独发布在线目录能力。

## 22. 实施任务分解

### Phase 0：导航与基础设施

- [ ] 安装并配置 React Navigation。
- [ ] 将现有页面迁移到 typed navigator，行为保持不变。
- [ ] 创建 Reading tab/stack 占位页。
- [ ] 安装 FileSystem、SQLite、WebView 和 XML/HTML 依赖。
- [ ] 建立数据库、migration runner 和 repository 测试。
- [ ] 建立阅读文件目录和临时目录清理。
- [ ] 添加授权 EPUB fixtures。

完成定义：现有功能回归通过；空阅读页可打开；数据库可初始化和升级。

### Phase 1：EPUB 导入与书库

- [ ] 实现 DocumentPicker EPUB 选择。
- [ ] 实现复制、哈希、重复检测和空间检查。
- [ ] 实现 ZIP 安全验证。
- [ ] 解析 container、OPF、spine、NCX/nav 和封面。
- [ ] 实现资源抽取、路径重写和 HTML 清洗。
- [ ] 使用事务保存书籍与章节。
- [ ] 实现书库、书籍详情、导入进度、错误和删除。
- [ ] 实现异常启动清理和失败重试。

完成定义：PRD AC-01、02、07、08 通过。

### Phase 2：阅读器与进度

- [ ] 构建受控 WebView HTML shell。
- [ ] 实现章节加载、目录跳转和上下章。
- [ ] 实现 bridge 消息 schema 与校验。
- [ ] 实现 locator 生成、保存、恢复和降级。
- [ ] 实现阅读设置与持久化。
- [ ] 处理 App background、返回键和错误降级。
- [ ] 真机性能测试和内存基线。

完成定义：PRD AC-03、09 通过；常用 fixture 章节均可读。

### Phase 3：查词与学习闭环

- [ ] 实现点击词边界与句子提取。
- [ ] 实现查词弹层和请求竞态保护。
- [ ] 复用本地词库和 `expo-speech`。
- [ ] 创建 `reading-vocabulary` 词包和 upsert API。
- [ ] 创建 `word_contexts` repository 和幂等写入。
- [ ] 改造单词详情展示多来源。
- [ ] 实现来源到 Reader 的跳转。
- [ ] 验证每日任务和 SM-2 进度不被覆盖。

完成定义：PRD AC-04、05、06 通过。

### Phase 4：增强与上线准备

- [ ] 书签/标注或推迟决定。
- [ ] 无障碍与多尺寸适配。
- [ ] 大文件和恶意 fixture 压测。
- [ ] 隐私与内容合规检查。
- [ ] README、用户帮助和故障说明。
- [ ] beta 数据回收和错误修复。

完成定义：PRD 上线标准全部满足。

### Phase 5：授权在线目录

- [ ] 明确内容许可和下架流程。
- [ ] 实现 catalog generator/validator。
- [ ] 建设受控 manifest 与下载存储。
- [ ] 实现目录缓存、下载、哈希、取消和重试。
- [ ] 实现来源/权利信息和远程 kill switch。
- [ ] 独立安全、合规和容量评审。

## 23. 建议提交序列

为了便于 review 和回滚，建议按以下粒度提交：

1. `refactor: migrate app screens to typed navigation`
2. `feat: add reading database and file store foundation`
3. `feat: parse and import local epub books`
4. `feat: add reading library and book details`
5. `feat: render sanitized epub chapters in reader`
6. `feat: persist and restore reading locators`
7. `feat: add tap lookup and reading vocabulary contexts`
8. `feat: link vocabulary sources back to reader`
9. `test: cover epub safety and reading workflows`
10. `docs: document local epub reading and privacy behavior`

不要在同一提交中同时进行导航重构、AppState 大迁移和 EPUB 解析器实现。

## 24. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 第三方刊物无分发授权 | 无法上线远程书库 | 本地导入先行；远程功能强制门禁 |
| JSZip 大文件内存峰值 | 导入崩溃 | 大小限制、真机压测、按需抽取；必要时换原生流式解压 |
| EPUB 格式差异大 | 部分书不可读 | fixture 矩阵、错误隔离、兼容性日志和降级样式 |
| WebView 内容攻击 | 数据或设备风险 | 清洗、导航拦截、bridge 校验、ZIP/XML 防护 |
| 跨 AsyncStorage/SQLite 写入 | 生词与语境不一致 | 幂等 fingerprint、补偿检查、长期迁移阅读词包到 SQLite |
| 导航重构影响现有学习 | 回归缺陷 | Phase 0 独立提交并完整回归 |
| locator 因排版变化失效 | 恢复位置不准 | 多策略 locator 和降级顺序 |
| GitHub API/Raw 不稳定 | 目录或下载失败 | 构建受控 manifest 和 CDN，不让客户端扫描仓库 |

## 25. 关键技术决策记录（ADR 摘要）

### ADR-001：MVP 只支持 EPUB

状态：接受。EPUB 可重排且适合文本命中；PDF/MOBI 的实现和体验成本不进入 MVP。

### ADR-002：文件系统 + SQLite 双存储

状态：接受。文件系统保存二进制和解压资源，SQLite 保存可查询元数据；AsyncStorage 继续承载现有轻量状态。

### ADR-003：章节通过受控 WebView 渲染

状态：接受。Native 组件难以兼容复杂 XHTML/CSS；WebView 必须配套严格清洗和消息校验。

### ADR-004：在线目录与内容源解耦

状态：接受。客户端读取版本化 manifest，不直接耦合 `awesome-english-ebooks`。

### ADR-005：阅读进度使用混合 Locator

状态：接受。章节百分比不足以抵抗字体和布局变化，使用锚点、文本引用和 progression 多级恢复。

## 26. 开工前检查清单

- [ ] 确定底部导航为四项或五项。
- [ ] 选定 XML 与 HTML 清洗实现并通过最小 PoC。
- [ ] 准备至少 5 个授权明确的 EPUB fixtures。
- [ ] 确定 iOS/Android 为首版必测平台，Web 是否暂缓。
- [ ] 确认本地词典命中后的展示字段和无释义降级文案。
- [ ] 为当前未提交改动建立清晰边界，避免覆盖用户工作。
- [ ] 建立导航迁移、数据库迁移和 EPUB 安全测试后再进入 UI 开发。
