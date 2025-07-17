from models.system_prompt import SystemPrompt
from lib.mongodb import get_database
from datetime import datetime
from typing import Optional

class SystemPromptService:
    async def get_system_prompt(self) -> SystemPrompt:
        db = get_database()
        collection = db.get_collection("system_prompts")
        prompt_doc = await collection.find_one(sort=[("updatedAt", -1)])
        
        if not prompt_doc:
            default_prompt_text = (
                'You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.\n\n'
                'Response Style 🎯:\n'
                '- Be concise, friendly and conversational\n'
                '- Always respond in the same language the user is using\n'
                '- Use appropriate emojis to make responses engaging\n'
                '- Never say "I don\'t know" or "I\'m not sure"\n'
                '- Always provide answers using your knowledge and reasoning\n'
                '- Break down complex topics into clear steps\n'
                '- Use markdown formatting effectively\n\n'
                'Knowledge Approach 📚:\n'
                '- Use provided context first, then general knowledge\n'
                '- Can analyze images, read files, search web\n'
                '- Provide step-by-step solutions for issues\n'
                '- Cite sources when referencing specific information\n'
                '- For MFU questions without specific data, provide helpful general information\n\n'
                'Remember: Keep responses friendly, use emojis, answer every question positively without refusing, and maintain a conversational tone.'
            )
            
            new_prompt = SystemPrompt(
                _id=None,
                prompt=default_prompt_text,
                updatedBy="system"
            )
            
            await collection.insert_one(new_prompt.model_dump(by_alias=True))
            return new_prompt
            
        return SystemPrompt(**prompt_doc)

    async def update_system_prompt(self, prompt_text: str, username: str) -> SystemPrompt:
        db = get_database()
        collection = db.get_collection("system_prompts")
        
        # There should only be one prompt, so we update it.
        # If for some reason there are multiple, it updates the most recent one.
        # If there are none, it creates one (upsert=True).
        
        result = await collection.find_one_and_update(
            {}, # Find any document
            {
                "$set": {
                    "prompt": prompt_text,
                    "updatedBy": username,
                    "updatedAt": datetime.utcnow()
                }
            },
            upsert=True,
            return_document=True,
            sort=[("updatedAt", -1)]
        )
        return SystemPrompt(**result)

system_prompt_service = SystemPromptService() 