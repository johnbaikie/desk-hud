const GoogleService = require('../../backend/services/GoogleService.js')
const { google } = require('googleapis');

const COMPLETED_DAYS = 7

class TodoService extends GoogleService {

  constructor(config, io, webApp) {
    super(config, io, webApp, 'todo')
    this._loop = null

    this.tasks = google.tasks({ version: 'v1', auth: this.auth });
  }

  async start() {
    if(this._loop) {
      clearInterval(this._loop)
    }
    this._loop = setInterval(() => this.update(), 1000*60*5)
    this.update()
  }

  async welcomeClient(socket) {
    try {
      this.emit(await this.fetchAll(), socket)
    } catch (err) {
      this.logger.error(err)
    }
  }

  async update() {
    try {
      this.emit(await this.fetchAll())
    } catch (err) {
      this.logger.error(err)
    }
  }

  // Every task from every Google Tasks list: open tasks first (list order,
  // then position), then tasks completed in the last COMPLETED_DAYS days.
  async fetchAll() {
    try {
      const lists = await this._queryAll(
        (pageToken) => this.tasks.tasklists.list({maxResults: 100, pageToken})
      )
      this._taskLists = {}
      const open = []
      const done = []
      const keepSince = Date.now() - COMPLETED_DAYS*24*60*60*1000
      for(const list of lists) {
        for(const task of await this._queryTodo(list.id)) {
          this._taskLists[task.id] = list.id
          if(!task.completed) {
            open.push(task)
          } else if(task.completed > keepSince) {
            done.push(task)
          }
        }
      }
      done.sort((a, b) => b.completed - a.completed)
      return {
        tasks: [...open, ...done],
        error: null
      }
    } catch (error) {
      if (error.response && error.response.data && (error.response.data.error === 'invalid_grant' || String(error.response.data.error_description).includes('Token has been expired or revoked'))) {
        this.logger.error('Token has been expired or revoked.')
        this.logger.error(error)
        return {
          tasks: [],
          error: 'token_expired'
        }
      } else if(error.response && error.response.data) {
        return {
          tasks: [],
          error: error.response.data.error + ': ' + error.response.data.error_description
        }
      } else {
        throw error
      }
    }
  }

  async setCompleted(taskId, completed) {
    const listId = this._taskLists && this._taskLists[taskId]
    if(!listId) {
      this.logger.error(`Task ${taskId} not found in any list`)
      return
    }
    this.logger.log(`${completed ? 'Complete' : 'Un-complete'} task ${taskId} from list ${listId}`)
    await this.tasks.tasks.patch({
      requestBody: completed ? {status: 'completed'} : {status: 'needsAction', completed: null},
      tasklist: listId,
      task: taskId
    })
    this.emit(await this.fetchAll())
  }

  async onMessage({action, id}) {
    switch(action) {
      case 'complete': return await this.setCompleted(id, true)
      case 'uncomplete': return await this.setCompleted(id, false)
      default: return super.onMessage({action, id})
    }
  }

  // follow nextPageToken so lists with more than 100 tasks are complete
  async _queryAll(request) {
    const items = []
    let pageToken
    do {
      const response = await request(pageToken)
      items.push(...(response.data.items || []))
      pageToken = response.data.nextPageToken
    } while(pageToken)
    return items
  }

  async _queryTodo(id) {
    // showHidden is needed: tasks completed in Google's own apps are hidden
    const items = await this._queryAll((pageToken) => this.tasks.tasks.list({
      tasklist: id,
      maxResults: 100,
      showCompleted: true,
      showHidden: true,
      pageToken
    }))

    return items
      .filter(t => t.title && !t.deleted)
      .map(t => ({
        id: t.id,
        title: t.title,
        updated: new Date(t.updated).getTime(),
        position: t.position,
        status: t.status,
        completed: new Date(t.completed).getTime() || null,
        due: new Date(t.due).getTime() || null,
      }))
      .sort((a, b) => {
        return String(a.position).localeCompare(String(b.position))
      })
  }

}

module.exports = TodoService