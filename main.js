const fs = require('fs')
const path = require('path')
const http = require('http')
const { ip } = require('address')
const mime = require('mime')
const QRCode = require('qrcode')
const { getIconForFile, getIconForFolder } = require('vscode-icons-js')

let EXPOSED_URL
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
      size: isDirectory ? null : stat.size,
      createTime: new Date(stat.birthtime),
      updateTime: new Date(stat.mtime),
      iconPath: getFileIconPath(basename, isDirectory),
    }
  })
}

function startedLog(port) {
  EXPOSED_URL = `http://${ip()}:${port}`
  console.log('\nlocal-server is running:')
  console.log(`http://127.0.0.1:${port}`)
  console.log(EXPOSED_URL)
  QRCode.toString(EXPOSED_URL, {
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

function initApis(req, res) {
  const url = getUrl(req)
  const params = getReqParams(req)
  res.writeHead(200, {'Content-Type': 'application/json'})
  if (url === '/api/getEnvVar') {
    res.end(JSON.stringify({
      EXPOSED_URL,
      CWD,
    }))
  }
}

let fsWatcher
function run(port = 8080) {
  const server = http.createServer(async (req, res) => {
    let url = getUrl(req)
    const params = getReqParams(req)
    if (url.startsWith('/api')) {
      initApis(req, res)
    } else {
      if (url === '/favicon.ico') {
        url = '/_assets' + url
      }
      let basePath = url.startsWith('/_assets') ? __dirname : CWD
      let sourcePath = path.join(basePath, url), source
      if (!fs.existsSync(sourcePath)) {
        sourcePath = path.join(__dirname, '_assets/views/404.html')
      }
      if (fs.statSync(sourcePath).isDirectory()) {
        const files = getFiles(sourcePath)
        sourcePath = path.join(__dirname, '_assets/views/index.html')
        source = fs.readFileSync(sourcePath, 'utf-8').replace('\`<%=files%>\`', JSON.stringify(files))
      } else {
        source = fs.readFileSync(sourcePath)
      }
      const mimeType = mime.getType(sourcePath)
      if (mimeType) {
        res.setHeader('Content-Type', mimeType)
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
