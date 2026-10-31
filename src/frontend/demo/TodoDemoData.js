export default class TodoDemoData {
  constructor() {
    const now = new Date().getTime()
    this._data = {
      "widgetId": "todo",
      "payload": {
        "tasks": [
          {
            "id": "7645375467457645674567",
            "title": "check emails",
            "position": "00000000000000000000",
            "status": "completed",
            "completed": now - 3*60*60*1000,
            "due": null
          },
          {
            "id": "345634563475643652345",
            "title": "review project timeline",
            "position": "00000000000000000001",
            "status": (new Date().getHours() > 12) ? "completed" : "needsAction",
            "completed": (new Date().getHours() > 12) ? now - 5*60*60*1000 : null,
            "due": null
          },
          {
            "id": "754745674567543456",
            "title": "schedule dentist appointment",
            "position": "00000000000000000006",
            "status": "needsAction",
            "completed": null,
            "due": null
          },
          {
            "id": "74567457453456343456",
            "title": "complete financial report",
            "position": "00000000000000000009",
            "status": "needsAction",
            "completed": null,
            "due": null
          },
          {
            "id": "8928377200011234",
            "title": "call rob",
            "position": "00000000000000000010",
            "status": "needsAction",
            "completed": null,
            "due": null
          }
        ]
      }
    }
  }

  get data() {
    return this._data
  }

  onMessage(payload) {
    if(payload.action === "complete") {
      this._data.payload.tasks = this._data.payload.tasks.map(item => {
        if(item.id !== payload.id) {
          return item
        }
        return {
          ...item,
          status: "completed",
          completed: new Date().getTime()
        }
      })
    } else if(payload.action === "uncomplete") {
      this._data.payload.tasks = this._data.payload.tasks.map(item => {
        if(item.id !== payload.id) {
          return item
        }
        return {
          ...item,
          status: "needsAction",
          completed: null
        }
      })
    } 
  }

}