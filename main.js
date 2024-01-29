const fs = require('fs')
const path = require('path')
const http = require('http')
const ejs = require('ejs')
const { ip } = require('address')
const mime = require('mime')
const { filesize } = require('filesize')
const QRCode = require('qrcode')
const { getIconForFile, getIconForFolder } = require('vscode-icons-js')

let EXPOSED_Url
const CWD = process.cwd()

function getFileIconPath(filename, isDirectory) {
  let iconName = isDirectory ? getIconForFolder(filename) : getIconForFile(filename)
  let iconPath = `/_assets/icons/${iconName}`
  const fullPath = path.join(__dirname, iconPath)
  if (!fs.existsSync(fullPath)) {
    iconPath =`/_assets/icons/${ isDirectory ? 'default_folder.svg' : 'default_file.svg'}`
  }
  return iconPath
}

function getFiles(dir) {
  return fs.readdirSync(dir).map((item) => {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)
    const isDirectory = stat.isDirectory()
    const basename = path.basename(fullPath)
    return {
      href: '/' + path.relative(CWD, path.join(dir, item)),
      name: basename,
      isDirectory,
      size: isDirectory ? '' : filesize(stat.size),
      createTime: new Date(stat.birthtime),
      updateTime: new Date(stat.mtime),
      iconPath: getFileIconPath(basename, isDirectory),
    }
  })
}

function renderFilesView(dir) {
  const ejsPath = path.join(__dirname, '_assets/views/index.ejs')
  const relativePath = dir.replace(CWD, '')
  const parts = relativePath.split('/').slice(1)
  const breadcrumb = parts.map((part, i) => ({
    name: part,
    href: '/' + parts.slice(0, i + 1).join('/')
  }))
  const files = getFiles(dir)
  return ejs.renderFile(ejsPath, {
    EXPOSED_Url,
    CWD,
    breadcrumb,
    files,
  })
}

function startedLog(port) {
  EXPOSED_Url = `http://${ip()}:${port}`
  console.log('\nlocal-server is running:')
  console.log(`http://127.0.0.1:${port}`)
  console.log(EXPOSED_Url)
  QRCode.toString(EXPOSED_Url, {
    type: 'terminal',
    small: true,
  }, (err, url) => console.log(`\n${url}`))
}

function getUrl(req) {
  return req.url.split('?')[0]
}
function getReqParams(req) {
  const search = req.url.split('?')[1]
  return search ? new URLSearchParams(search) : null
}

let fsWatcher
function run(port = 8080) {
  const server = http.createServer(async (req, res) => {
    let url = getUrl(req)
    const params = getReqParams(req)
    if (url === '/favicon.ico') {
      url = '/_assets' + url
    }
    let basePath = url.startsWith('/_assets') ? __dirname : CWD
    let sourcePath = path.join(basePath, url)
    const stat = fs.statSync(sourcePath)
    if (stat.isDirectory()) {
      const html = await renderFilesView(sourcePath)
      res.end(html)
    } else {
      const source = fs.readFileSync(sourcePath)
      const mimeType = mime.getType(sourcePath)
      if (mimeType) {
        res.setHeader('Content-Type', mimeType)
        res.setHeader('Content-Length', stat.size)
      }
      if (params?.has('attachment')) {
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(sourcePath)}"`)
      }
      res.end(source)
    }
  })
  server.listen(port, '0.0.0.0', () => startedLog(port))
  if (fsWatcher) {
    fsWatcher.close()
  }
  fsWatcher = fs.watch(__dirname, {recursive: true}, () => {
    server.close()
    run(port)
  })
}

module.exports = run
