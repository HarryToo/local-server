const fs = require('fs')
const pt = require('path')
const http = require('http')
const ejs = require('ejs')
const { ip } = require('address')
const { filesize } = require('filesize')
const { getIconForFile, getIconForFolder } = require('vscode-icons-js')

function getFiles(dir) {
  const result = []
  const items = fs.readdirSync(dir)
  for (const item of items) {
    const fullPath = pt.join(dir, item)
    const stat = fs.statSync(fullPath)
    const basename = pt.basename(fullPath)
    result.push({
      path: fullPath,
      name: basename,
      size: filesize(stat.size),
      createTime: new Date(stat.birthtime),
      updateTime: new Date(stat.mtime),
      iconName: stat.isDirectory() ? getIconForFolder(basename) : getIconForFile(basename)
    })
  }
  return result
}

function renderFilesView(dir) {
  const ejsPath = pt.join(__dirname, '_assets/views/index.ejs')
  const files = getFiles(dir)
  return ejs.renderFile(ejsPath, {files})
}

function startedLog(port) {
  console.log('local-server is running')
  console.log('Available on:')
  console.log(`  http://127.0.0.1:${port}`)
  console.log(`  http://${ip()}:${port}`)
}

function run(port = 8080) {
  const server = http.createServer(async (req, res) => {
    const url = req.url
    let basePath = url.startsWith('/_assets') ? __dirname : process.cwd()
    const sourcePath = pt.join(basePath, url)
    const stat = fs.statSync(sourcePath)
    if (stat.isDirectory()) {
      const html = await renderFilesView(sourcePath)
      res.end(html)
    } else {
      const source = fs.readFileSync(sourcePath)
      res.end(source)
    }
  })
  server.listen(port, '0.0.0.0', () => startedLog(port))
}

module.exports = run
