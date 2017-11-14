#include <ArduinoJson.h>

const int RECORD = 1;
const int STOP_RECORDING = 2;
const int PLAYBACK = 3;
const int STOP_PLAYBACK = 4;

int currentAction = STOP_RECORDING;

int incomingByte = 0;
String inData = "";
const char endChar = '\n';

StaticJsonBuffer<255> jsonBuffer;

void setup()
{
    Serial.begin(9600);
}

void loop()
{
    while (Serial.available() > 0)
    {
        char received = Serial.read();
        
        // Process message when new line character is received
        if (received == endChar)
        {
            JsonObject& request = stringToJSON(inData);
            handleRequest(request);
            
            inData = "";
        }
        else
        {
            inData.concat(received);
        }
    }

    if(currentAction == RECORD)
    {
        JsonObject& root = createJSONObject();
        root["data"] = random(255);
        
        root.printTo(Serial);
        Serial.println();
    }
    
    delay(100);
}

void handleRequest(JsonObject& request)
{
    currentAction = (int) request["action"];
 
    switch (currentAction)
    {
        case RECORD:
          TXLED1;
          break;
        
        case STOP_RECORDING:
          TXLED0;
          break;

        case PLAYBACK:
          vibrate((int) request["data"]);
          break;

        case STOP_PLAYBACK:
          stopVibration();
          break;
    }
}

void vibrate(int amp)
{
    if(amp > 127)
      TXLED1;
    else if(amp <= 127)
      TXLED0;
}

void stopVibration()
{
    TXLED0;
}

JsonObject& stringToJSON(String s)
{
    StaticJsonBuffer<255> jsonBuffer;
    return jsonBuffer.parseObject(s);
}

JsonObject& createJSONObject()
{
    StaticJsonBuffer<255> jsonBuffer;
    return jsonBuffer.createObject();
}