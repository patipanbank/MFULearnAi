import json

class ToolService:
    def __init__(self):
        self.tools = [
            {
                "toolSpec": {
                    "name": "get_weather",
                    "description": "Get the current weather for a given city.",
                    "inputSchema": {
                        "json": {
                            "type": "object",
                            "properties": {
                                "city": {
                                    "type": "string",
                                    "description": "The city to get the weather for, e.g., 'Bangkok'.",
                                }
                            },
                            "required": ["city"],
                        }
                    },
                }
            }
        ]
        self.tool_functions = {
            "get_weather": self.get_weather
        }

    def get_weather(self, city: str):
        """Get the current weather for a given city."""
        if "bangkok" in city.lower():
            return json.dumps({"city": "Bangkok", "temperature": "32°C", "description": "Sunny"})
        elif "london" in city.lower():
            return json.dumps({"city": "London", "temperature": "15°C", "description": "Cloudy"})
        else:
            return json.dumps({"city": city, "temperature": "unknown", "description": "Weather data not available"})

    def get_tool_config(self, user_info=None):
        # This can be expanded to filter tools based on user_info
        return {"tools": self.tools}

tool_service = ToolService()
tools = tool_service.tools
tool_functions = tool_service.tool_functions 