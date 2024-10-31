const Homey = require('homey');
const WebSocket = require('ws');
const LogToFile = require('homey-log-to-file');

class MyApp extends Homey.App {
  async onInit() {
    await LogToFile();
    this.tokens = {};  // Tokens object om dynamisch aangemaakte tokens op te slaan
    this.triggerUnifiAccess = this.homey.flow.getTriggerCard('receive');
    this.log('App UnifiAccess is gestart');
    this._connectWebSocket();
  }

  _connectWebSocket() {
    const ipadress = this.homey.settings.get('ipadress');
    const port = this.homey.settings.get('port');
    const apikey = this.homey.settings.get('apikey');

    const ws = new WebSocket('wss://' + ipadress + ':' + port + '/api/v1/developer/devices/notifications', {
      rejectUnauthorized: false,
      headers: {
        'Authorization': 'Bearer ' + apikey,
        'Upgrade': 'websocket',
        'Connection': 'Upgrade'
      }
    });

    ws.on('open', () => {
      console.log('WebSocket verbinding geopend');
      this._log('WebSocket verbinding geopend');
    });

    ws.on('message', async (data) => {
      const jsonData = JSON.parse(data.toString('utf8'));
      if (jsonData != 'Hello') {
        console.log('Data ontvangen:', jsonData);
        this._log(JSON.stringify(jsonData, null, 2)); // Log de ontvangen data

        await this.homey.settings.set('logboek', JSON.stringify(jsonData));
        await this.processJson('', jsonData);
        this.triggerUnifiAccess.trigger({
          receivedData: jsonData
        }).catch(err => this.error('Flow trigger fout:', err));
      }
    });

    ws.on('error', (error) => {
      console.error('Fout in WebSocket verbinding:', error);
      this._log('WebSocket fout: ' + error.message);
      this._reconnectWebSocket();
    });

    ws.on('close', () => {
      console.log('WebSocket verbinding gesloten, opnieuw verbinden...');
      this._log('WebSocket verbinding gesloten');
      this._reconnectWebSocket();
    });
  }

  _reconnectWebSocket() {
    setTimeout(() => {
      console.log('Opnieuw proberen verbinding te maken...');
      this._connectWebSocket();
    }, 30000); // Wacht 5 seconden voordat er opnieuw verbinding wordt gemaakt
  }

  async processJson(prefix, obj) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const tokenName = `${prefix}${key}`;

        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value) || typeof value === 'object') {
            await this.createOrUpdateToken(tokenName, JSON.stringify(value));
          } else {
            await this.processJson(`${tokenName}_`, value);
          }
        } else {
          await this.createOrUpdateToken(tokenName, value);
        }
      }
    }
  }

async createOrUpdateToken(name, value) {
  let tokenType;
  if (typeof value === 'boolean') {
    tokenType = 'boolean';
  } else if (typeof value === 'number') {
    tokenType = 'number';
  } else {
    tokenType = 'string';
  }

  // Controleer of de token al bestaat
  if (!this.tokens[name]) {
    try {
      // Probeer de token aan te maken
      this.tokens[name] = await this.homey.flow.createToken(name, {
        type: tokenType,
        title: name
      });
      this.log(`Token ${name} aangemaakt met type ${tokenType}`);
    } catch (err) {
      if (err.code === 409) {
        // Token bestaat al, haal hem op in plaats van opnieuw aan te maken
        this.tokens[name] = this.homey.flow.getToken(name);
        this.log(`Token ${name} bestaat al, opgehaald in plaats van opnieuw aangemaakt`);
      } else {
        throw err; // Hergooi andere fouten
      }
    }
  }

  // Update de waarde van de token
  await this.tokens[name].setValue(value);
  this.log(`Token ${name} bijgewerkt met waarde: ${value}`);
}


  _log(message) {
    const timestamp = new Date().toISOString();
    this.log(`[${timestamp}] ${message}`);
  }
}

module.exports = MyApp;
