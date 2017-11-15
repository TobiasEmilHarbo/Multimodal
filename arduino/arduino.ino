#include <Wire.h>
#include "Adafruit_DRV2605.h"
#include <ArduinoJson.h>

const int RECORD = 1;
const int STOP_RECORDING = 2;
const int PLAYBACK = 3;
const int STOP_PLAYBACK = 4;
const int SUBMIT = 5;
const int CALIBRATE = 6;
const int STOP_CALIBRATION = 7;

int currentAction = STOP_RECORDING;

int maxPressure = 0;
int fsrAnalogPin = 9;
int incomingByte = 0;
String inData = "";
const char endChar = '\n';

StaticJsonBuffer<255> jsonBuffer;
Adafruit_DRV2605 drv;

void setup()
{
    Serial.begin(9600);
    drv.begin();
    //drv.useLRA();
    drv.useERM();

    drv.setMode(DRV2605_MODE_REALTIME);
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
        int fsrReading = analogRead(fsrAnalogPin);
        int amp = map(fsrReading, 0, maxPressure, 0, 128);
        root["data"] = amp;

        root.printTo(Serial);
        Serial.println();

        vibrate(amp);
    }

    if(currentAction == CALIBRATE)
    {
        int fsrReading = analogRead(fsrAnalogPin);
        maxPressure = max(maxPressure, fsrReading);
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

        case STOP_CALIBRATION:
          
          break;
    }
}

void vibrate(int amp)
{
    TXLED1;
    drv.setRealtimeValue(amp);
}

void stopVibration()
{
    TXLED0;
    drv.setRealtimeValue(0);
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
