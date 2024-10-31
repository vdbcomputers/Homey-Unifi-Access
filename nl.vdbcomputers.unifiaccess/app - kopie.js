const Homey = require('homey');
const WebSocket = require('ws');
const fs = require('fs');
const https = require('http');

class MyApp extends Homey.App {

  onInit() {
    this._connectWebSocket();
  }

  _connectWebSocket() {
    const ws = new WebSocket('wss://192.168.178.1:12445/api/v1/developer/devices/notifications', {
      rejectUnauthorized: false,
      headers: {
        'Authorization': 'Bearer +1Un+EspnL+ieNI8r966LA',
        'Upgrade': 'websocket',
        'Connection': 'Upgrade'
      }
    });

    ws.on('open', function open() {
      console.log('WebSocket verbinding geopend');
    });

    ws.on('message', (data) => {
      const textData = data.toString('utf8');
      console.log('Data ontvangen:', textData);

      if (textData.includes('access.open_door:door"')) {
        this._triggerAction('deur open', textData);
        this._sendHttpRequest('http://thuis.vdbcomputers.nl:8585/deuropen');
      } else if (textData.includes('"access.remote_view"')) {
        this._triggerAction('deurbel', textData);
        this._sendHttpRequest('http://thuis.vdbcomputers.nl:8585/deurbel');
      }
    });

    ws.on('error', (error) => {
      console.error('Fout in WebSocket verbinding:', error);
    });
  }

  _sendHttpRequest(url) {
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', (chunk) => {
        data += chunk;
      });
      resp.on('end', () => {
        console.log('Response van de server:', data);
      });
    }).on("error", (err) => {
      console.log("Fout bij het HTTP-verzoek:", err.message);
    });
  }

  _triggerAction(action, data) {
    fs.appendFile('/volume1/docker/deurbel/output.txt', data + '\n', (err) => {
      if (err) {
        console.error('Er was een fout bij het schrijven naar het bestand:', err);
      } else {
        console.log('Data succesvol naar bestand geschreven');
      }
    });
  }
}

module.exports = MyApp;
