#include <ArduinoJson.h>

int incomingByte = 0;
String inData = "";
char endChar = '\n';

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
            JsonObject& data = stringToJSON(inData);

            if(data["led"] == "ON")
            {
                TXLED1;
            }
            else if(data["led"] == "OFF")
            {
                TXLED0;
            }
            
            JsonObject& root = createJSONObject();
            root["data"] = data["led"];
        
            root.printTo(Serial);
            Serial.println();
            
            inData = "";
        }
        else
        {
            inData.concat(received);
        }
    }
}

JsonObject& stringToJSON(String s)
{
    StaticJsonBuffer<256> jsonBuffer;
    return jsonBuffer.parseObject(s);
}

JsonObject& createJSONObject()
{
    StaticJsonBuffer<256> jsonBuffer;
    return jsonBuffer.createObject();
}
