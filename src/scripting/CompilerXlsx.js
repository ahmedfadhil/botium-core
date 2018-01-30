const util = require('util')
const XLSX = require('xlsx')
const _ = require('lodash')
const debug = require('debug')('botium-CompilerXlsx')

const Capabilities = require('../Capabilities')
const CompilerBase = require('./CompilerBase')
const { ConvoHeader, Convo } = require('./Convo')

module.exports = class CompilerXlsx extends CompilerBase {
  constructor(caps = {}) {
    super(caps)
    
    this.colnames = [ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z' ]
  }

  Validate () {
    return super.Validate().then(() => {
      this._AssertCapabilityExists(Capabilities.SCRIPTING_XLSX_STARTROW)
      this._AssertCapabilityExists(Capabilities.SCRIPTING_XLSX_STARTCOL)
      
      if (_.isString(this.caps[Capabilities.SCRIPTING_XLSX_STARTCOL]) && this.colnames.findIndex((c) => c === this.caps[Capabilities.SCRIPTING_XLSX_STARTCOL]) < 0) {
        throw new Error(`SCRIPTING_XLSX_STARTCOL ${this.caps[Capabilities.SCRIPTING_XLSX_STARTCOL]} invalid (A-Z)`)
      } else if (this.caps[Capabilities.SCRIPTING_XLSX_STARTCOL] < 1 || this.caps[Capabilities.SCRIPTING_XLSX_STARTCOL] > this.colnames.length) {
        throw new Error(`SCRIPTING_XLSX_STARTCOL ${this.caps[Capabilities.SCRIPTING_XLSX_STARTCOL]} invalid (1-${this.colnames.length})`)
      }
    })
  }

  GetHeaders (scriptData) {
    throw new Error(`not implemented`)
  }

  Compile (scriptData) {
    return new Promise((resolve, reject) => {
      const workbook = XLSX.read(scriptData, { type: this.caps[Capabilities.SCRIPTING_INPUT_TYPE]})

      if (!workbook) return reject(new Error(`Workbook not readable`))
      
      let sheetnames = workbook.SheetNames
      if (this.caps[Capabilities.SCRIPTING_XLSX_SHEETNAMES]) {
        sheetnames = this.caps[Capabilities.SCRIPTING_XLSX_SHEETNAMES].split(/\s*[;,\s\|]\s*/)
      }
      debug(`sheet names: ${util.inspect(sheetnames)}`)

      const convos = []
      sheetnames.forEach((sheetname) => {
        const sheet = workbook.Sheets[sheetname]
        if (!sheet) return

        let rowindex = this.caps[Capabilities.SCRIPTING_XLSX_STARTROW]
        let colindex = this.caps[Capabilities.SCRIPTING_XLSX_STARTCOL] - 1
        if (_.isString(this.caps[Capabilities.SCRIPTING_XLSX_STARTCOL])) {
          colindex = this.colnames.findIndex((c) => c === this.caps[Capabilities.SCRIPTING_XLSX_STARTCOL])
        }

        let currentConvo = []
        let emptylines = 0
        let startcell = null
        while (true) {
          const meCell = this.colnames[colindex] + rowindex
          const botCell = this.colnames[colindex + 1] + rowindex
          debug(`evaluating sheet name: ${util.inspect(sheetname)}, me ${meCell}, bot ${botCell}`)
          
          if (sheet[meCell] && sheet[meCell].v) {
            currentConvo.push({ sender: 'me', messageText: sheet[meCell].v })
            if (!startcell) startcell = meCell
          } else if (sheet[botCell] && sheet[botCell].v) {
            currentConvo.push({ sender: 'bot', messageText: sheet[botCell].v })
            if (!startcell) startcell = meCell
          } else {
            if (currentConvo.length > 0) {
              convos.push(new Convo({
                header: {
                  name: `${sheetname}-${startcell}`
                },
                conversation: currentConvo
              }))
            }
            currentConvo = []
            startcell = null
            emptylines++
          }
          rowindex++
          
          if (emptylines > 1)
            break
        }
      })
      resolve(convos)
    })
  }
}
