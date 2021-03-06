"use strict"

let DownloadService = require('../components/download.service')
let helpers         = require('./support/helpers')
let config          = require('../config')
config.db           = '' //In memory
let moment          = require('moment')
let DbService       = require('../components/db.service')


describe('DbService', function() {

  beforeEach(function() {
    DbService.initDb()

    this.fakeUri = '/feeds/cells/1roykKRAFpxs96Knxme7dsS-xf0kVy6DPyx3WCbte9Ok/od6/public/values'
    this.fakeUri2 = '/feeds/cells/1wbwnemApw1nDjuDROtHXmX-BydlMLwgk7Klg_ap9d8w/osdpulb/public/values'
    this.fakeUri3 = '/feeds/worksheets/1wbwnemApw1nDjuDROtHXmX-BydlMLwgk7Klg_ap9d8w/public/basic'

    this.groupUri = '1roykKRAFpxs96Knxme7dsS-xf0kVy6DPyx3WCbte9Ok'
    this.groupUri2 = '1wbwnemApw1nDjuDROtHXmX-BydlMLwgk7Klg_ap9d8w'

    this.fakeTitle = "Values1"
    this.fakeTitle2 = "Values2"
    this.fakeTitle3 = "Basic3"

    this.fakeSpreadsheet1 = {
      quote: 'A bargain is something you don’t need at a price you can’t resist.',
      author: ' FRANKLIN JONES',
      feed: {
        title: {
          $t: this.fakeTitle
        }
      }
    }

    this.fakeSpreadsheet2 = {
      quote: 'Some cause happiness wherever they go; others, whenever they go.',
      author: 'OSCAR WILDE',
      feed: {
        title: {
          $t: this.fakeTitle2
        }
      }
    }

    this.fakeSpreadsheet3 = {
      quote: 'I read recipes the same way I read science fiction. I get to the end and I think, “Well, that’s not going to happen.”',
      author: 'ANONYMOUS',
      feed: {
        title: {
          $t: this.fakeTitle3
        }
      }
    }

    this.fakeRecord1 = {
      name: this.fakeUri,
      spreadsheet: JSON.stringify(this.fakeSpreadsheet1),
      dateLastRequested: moment().subtract(1, 'day').toISOString()
    }

    this.fakeRecord2 = {
      name: this.fakeUri2,
      spreadsheet: JSON.stringify(this.fakeSpreadsheet2),
      dateLastRequested: moment().subtract(2, 'day').toISOString()
    }

    this.fakeRecord3 = {
      name: this.fakeUri3,
      spreadsheet: JSON.stringify(this.fakeSpreadsheet3),
      dateLastRequested: moment().subtract(2, 'day').toISOString()
    }

  })


  describe('getSpreadsheet', function() {
    beforeEach(function() {
      this.fakeUri = 'some/url'
      this.spreadsheet = {
        name: 'spreadsheet'
      }

      spyOn(DbService, 'getCachedSpreadsheet').andReturn(helpers.fakePromise(true, this.spreadsheet))
      spyOn(DownloadService, 'downloadSpreadsheet').andReturn(helpers.fakePromise(true, this.spreadsheet))
      spyOn(DbService, 'cacheSpreadsheet')
    })

    it('should get cached spreadsheet and resolve if found', function(done) {
      DbService.getSpreadsheet(this.fakeUri)
      .then(res => {
        expect(res).toEqual(this.spreadsheet)
        expect(DbService.getCachedSpreadsheet).toHaveBeenCalledWith(this.fakeUri)
        expect(DownloadService.downloadSpreadsheet).not.toHaveBeenCalled()
        done()
      })
    })

    it('should download and cache spreadsheet if lost', function(done) {
      DbService.getCachedSpreadsheet.andReturn(helpers.fakePromise(false, null))

      DbService.getSpreadsheet(this.fakeUri)
      .then(res => {
        expect(res).toEqual(this.spreadsheet)
        expect(DownloadService.downloadSpreadsheet).toHaveBeenCalledWith(this.fakeUri)
        expect(DbService.cacheSpreadsheet).toHaveBeenCalledWith(this.fakeUri, this.spreadsheet)
        done()
      })
    })
  })

  describe('getInformationAboutSpreadsheets', function() {
    beforeEach(function(done) {
      DbService.db.insert([this.fakeRecord1, this.fakeRecord2, this.fakeRecord3], () => { done() 
      })
    })

    it('should get sorted info about spreadsheets', function(done) {
      DbService.getInformationAboutSpreadsheets()
      .then(data => {
        expect(data.total).toBe(2)
        expect(data.spreadsheets[0].groupUri).toBe(this.groupUri)
        expect(data.spreadsheets[1].groupUri).toBe(this.groupUri2)
        expect(data.spreadsheets[0].title).toEqual(undefined)
        expect(data.spreadsheets[1].title).toBe(this.fakeTitle3)
        expect(moment(data.spreadsheets[0].dateLastRequested).diff(this.fakeRecord1.dateLastRequested) < 1000).toBe(true)
        expect(moment(data.spreadsheets[1].dateLastRequested).diff(this.fakeRecord2.dateLastRequested) < 1000).toBe(true)
        done()
      })
      .catch(done)
    })
  })

  describe('CacheSpreadsheet', function() {
    beforeEach(function() {
      this.fakeSpreadsheet1 = {
        quote: 'By all means, marry. If you get a good wife, you’ll become happy; if you get a bad one, you’ll become a philosopher.',
        author: 'Socrates'
      }
      this.fakeUri = 'some/url'
    })

    it('should cache spreadsheet', function(done) {
      DbService.cacheSpreadsheet(this.fakeUri, this.fakeSpreadsheet1)
      .then(() => {
        DbService.db.find({}, (err, records) => {
          expect(records.length).toBe(1)
          expect(records[0].name).toEqual(this.fakeUri)
          expect(JSON.parse(records[0].spreadsheet)).toEqual(this.fakeSpreadsheet1)
          done()
        })
      })
      .catch(done)
    })
  })

  describe('getCachedSpreadsheet', function() {
    beforeEach(function(done) {
      this.fakeNonExistingUri = 'some/url/missing'
      this.dateNow = moment()

      DbService.db.insert([this.fakeRecord1, this.fakeRecord2], () => { done() } )
    })

    it('should get data out of the database', function(done) {
      DbService.getCachedSpreadsheet(this.fakeUri)
      .then(result => {
        expect(result).toEqual(this.fakeSpreadsheet1)
        done()
      })
      .catch(done)
    })

    it('should update dateLastRequested to the current one', function(done) {
      DbService.getCachedSpreadsheet(this.fakeUri)
      .then(result => {
        return DbService.db.findAsync({})
      })
      .then((records) => {
        expect(records.length).toBe(2)
        return DbService.db.findOneAsync({name: this.fakeUri})
      })
      .then(record => {        
        expect(record.dateLastRequested).not.toEqual(this.fakeRecord1.dateLastRequested)
        
        let dateDiff = Math.abs(this.dateNow.diff(moment(record.dateLastRequested)))
        expect(dateDiff < 1000).toBe(true) //Make sure that the date updated and the difference with current date is no more than a second

        return DbService.db.findOneAsync({name: this.fakeUri2})
      })
      .then(record => {        
        expect(record.dateLastRequested).toEqual(this.fakeRecord2.dateLastRequested)
        done()
      })
      .catch(done)
    })

    it('should return rejection if there is no record found', function(done) {
      DbService.getCachedSpreadsheet(this.fakeNonExistingUri)
      .then(() => {
        expect(true).toBe(false) //Will fail if even called
      }, (err) => {
        expect(err).toBe('No record found')
        done()
      })
      .catch(done)   
    })

  })

  describe('updateOrRemoveSpreadsheets', function() {
    beforeEach(function(done) {
      DbService.db.insert([this.fakeRecord1, this.fakeRecord2], () => { done() } ) //first was accessed in 24h and second — in 48h 
      config.removeTimeout = 1000 * 60 * 60 * 25 //25 hours
    
      spyOn(DownloadService, 'downloadSpreadsheet').andReturn(helpers.fakePromise(true, this.fakeSpreadsheet3))
    })

    it('should update non-expired spreadsheet', function(done) {
      DbService.updateOrRemoveSpreadsheets()
      .then(() => {
        return DbService.db.findOneAsync( {name: this.fakeUri} )
      })
      .then(record => {
        expect(record.name).toEqual(this.fakeRecord1.name)
        expect(JSON.parse(record.spreadsheet)).toEqual(this.fakeSpreadsheet3)
        expect(DownloadService.downloadSpreadsheet).toHaveBeenCalledWith(this.fakeUri)
        expect(DownloadService.downloadSpreadsheet.callCount).toBe(1)

        done()
      })
      .catch(done)
    })

    it('should remove expired spreadsheet', function(done) {
      DbService.updateOrRemoveSpreadsheets()
      .then(() => {
        return DbService.db.findAsync({})
      })
      .then(records => {
        expect(records.length).toBe(1)
        expect(records[0].name).not.toEqual(this.fakeRecord2.name)
        done()
      })
      .catch(done)
    })
  })

  describe('removeSpreadsheetGroup', function() {
    beforeEach(function(done) {
      this.nonExistingSpreadsheet = '/hahaha/'

      DbService.db.insert([this.fakeRecord1, this.fakeRecord2, this.fakeRecord3], () => { done() } )
    })

    it('should remove selected spreadsheets', function(done) {
      DbService.removeSpreadsheetGroup(this.groupUri2)
      .then(numRemoved => {
        expect(numRemoved).toBe(2)

        DbService.db.find({}, (err, records) => {
          expect(records.length).toBe(1)
          done()
        })
      })
      .catch(done)
    })

    it('should return 404 if not found', function(done) {
      DbService.removeSpreadsheetGroup(this.nonExistingSpreadsheet)
      .then(() => {
        
      })
      .catch(function(err) {
        expect(err.status).toBe(404)

        DbService.db.find({}, (err, records) => {
          expect(records.length).toBe(3)
          done()
        })
      })
    })
  })

  describe('removeEverything', function() {
    beforeEach(function(done) {
      DbService.db.insert([this.fakeRecord1, this.fakeRecord2], () => { done() } )
    })

    it('should remove all the records', function(done) {
      DbService.removeEverything()
      .then(numRemoved => {
        expect(numRemoved).toBe(2)
        done()
      })
      .catch(done)
    })
  })


})
