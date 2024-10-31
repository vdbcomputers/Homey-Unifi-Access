const Homey = require('homey');
const WebSocket = require('ws');
const LogToFile = require('homey-log-to-file');

class MyApp extends Homey.App {

  async onInit() {
	  await LogToFile();
    this._connectWebSocket();
    
	
	
    this.tokens = {};  // Tokens object om dynamisch aangemaakte tokens op te slaan
    
    // Flow trigger registreren
    this.triggerUnifiAccess = this.homey.flow.getTriggerCard('receive');
    
    this.log('App UnifiAccess is gestart');
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
      // Loop door alle data heen en maak tokens voor elk veld
      await this.processJson('', jsonData);

      // Trigger de flow wanneer er data wordt ontvangen
      this.triggerUnifiAccess.trigger({
        receivedData: jsonData  // Hiermee kun je de ontvangen data doorgeven aan de flow
		
      }).catch(err => this.error('Flow trigger fout:', err));
    }
  });

    ws.on('error', (error) => {
      console.error('Fout in WebSocket verbinding:', error);
      this._log('WebSocket fout: ' + error.message);
    });

  }

  // Recursieve functie om door de JSON te lopen en tokens aan te maken
  async processJson(prefix, obj) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const tokenName = `${prefix}${key}`;  // Dynamische tokennaam

        // Als de waarde een object is, controleer of het een array of genest object is
        if (typeof value === 'object' && value !== null) {
          // Converteer objecten naar JSON-string voordat ze worden opgeslagen
          if (Array.isArray(value) || typeof value === 'object') {
            await this.createOrUpdateToken(tokenName, JSON.stringify(value));
          } else {
            await this.processJson(`${tokenName}_`, value);  // Roep recursief aan met nieuwe prefix
          }
        } else {
          // Als het een primitieve waarde is, maak een token of update de waarde
          await this.createOrUpdateToken(tokenName, value);
        }
      }
    }
  }

  // Functie om dynamisch tokens aan te maken of te updaten met typecontrole
  async createOrUpdateToken(name, value) {
    let tokenType;
    
    // Bepaal het type token op basis van de waarde
    if (typeof value === 'boolean') {
      tokenType = 'boolean';
    } else if (typeof value === 'number') {
      tokenType = 'number';  // Aangepast type voor getallen
    } else {
      tokenType = 'string';  // Gebruik string voor JSON-objecten of gewone strings
    }

    // Als de token nog niet bestaat, maak een nieuwe
    if (!this.tokens[name]) {
      this.tokens[name] = await this.homey.flow.createToken(name, {
        type: tokenType,
        title: name
      });
      this.log(`Token ${name} aangemaakt met type ${tokenType}`);
    }

    // Update de token met de nieuwe waarde
    await this.tokens[name].setValue(value);
    this.log(`Token ${name} bijgewerkt met waarde: ${value}`);
  }

  _log(message) {
    const timestamp = new Date().toISOString();
    this.log(`[${timestamp}] ${message}`);
  }
}

module.exports = MyApp;
