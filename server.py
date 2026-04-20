import os
from datetime import datetime
from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from google import genai

# Load environment variables
load_dotenv()

app = FastAPI(title="Dealer Mitra API")

# Allow CORS for local frontend testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize connections
mongo_client = None
gemini_client = None

@app.on_event("startup")
async def startup_event():
    global mongo_client, gemini_client
    
    # 1. Connect to MongoDB
    mongodb_uri = os.getenv("MONGODB_URI")
    if mongodb_uri:
        try:
            mongo_client = MongoClient(mongodb_uri, server_api=ServerApi('1'))
            # Send a ping to confirm a successful connection
            mongo_client.admin.command('ping')
            print("Successfully connected to MongoDB!")
        except Exception as e:
            print(f"Failed to connect to MongoDB: {e}")
    else:
        print("WARNING: MONGODB_URI not found in .env")

    # 2. Connect to Google Gemini
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if google_api_key:
        try:
            gemini_client = genai.Client(api_key=google_api_key)
            print("Successfully initialized Google Gemini Client!")
        except Exception as e:
            print(f"Failed to initialize Google Gemini Client: {e}")
    else:
        print("WARNING: GOOGLE_API_KEY not found in .env")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to Dealer Mitra API",
        "mongodb_connected": mongo_client is not None,
        "gemini_connected": gemini_client is not None
    }

class OrderItem(BaseModel):
    product: str
    quantity: int

class OrderRequest(BaseModel):
    items: List[OrderItem]

@app.post("/api/orders")
def create_order(order: OrderRequest):
    if not mongo_client:
        return {"status": "error", "message": "Database not connected"}
    
    db = mongo_client.dealer_mitra
    orders_col = db.orders
    
    order_doc = {
        "items": [item.dict() for item in order.items],
        "created_at": datetime.utcnow(),
        "status": "pending"
    }
    
    result = orders_col.insert_one(order_doc)
    return {
        "status": "success", 
        "message": "Order created successfully", 
        "order_id": str(result.inserted_id),
        "item_count": len(order.items)
    }

@app.get("/api/dashboard/briefing")
def get_dashboard_briefing():
    if not gemini_client:
        return {"status": "error", "message": "Gemini AI not connected"}
    
    # We'll pass the inventory summary stats in the prompt
    inventory_context = "In Stock: 142 SKUs, Low Stock: 8 SKUs, Out of Stock: 12 SKUs"
    prompt = f"""
    Based on the following inventory status for an agricultural input dealer, provide a one-sentence, professional "Action of the Day".
    Focus on urgency and efficiency.
    Status: {inventory_context}
    """
    
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        briefing = response.text.strip()
        return {"status": "success", "briefing": briefing}
    except Exception as e:
        print(f"Error generating briefing: {e}")
        # Fallback briefing
        return {
            "status": "success", 
            "briefing": "Focus on restock orders for the 12 out-of-stock SKUs to maintain Paddy season momentum.",
            "note": "fallback"
        }

import json

@app.get("/api/bundles/recommendations")
def get_bundle_recommendations():
    if not gemini_client:
        return {"status": "error", "message": "Gemini AI not connected"}
    
    prompt = """
    You are an expert agricultural B2B advisor. Generate exactly 3 "Seasonal Bundles" of agricultural inputs for a dealer.
    The response MUST be a raw JSON array of objects. Do not include markdown formatting like ```json.
    Each object must have:
    - "title": A short, catchy name for the bundle (e.g., "Paddy Starter Kit")
    - "description": A concise combination of 2-3 products (e.g., "O-MAX + Bio-NPK + Zinc")
    """
    
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        # Clean up the response in case it has markdown ticks
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        bundles = json.loads(raw_text.strip())
        return {"status": "success", "data": bundles}
    except Exception as e:
        print(f"Error generating recommendations: {e}")
        # Fallback to local mock data if the API is overloaded (e.g. 503)
        fallback_bundles = [
            {"title": "Paddy Pro Kit", "description": "O-MAX 40kg + Bio-NPK 1L"},
            {"title": "Cotton Yield Booster", "description": "Humate Power 1L + Bramha-Zyme 5kg"},
            {"title": "Soil Revival Bundle", "description": "Neo-20 25kg + Humate Power 1L"}
        ]
        return {"status": "success", "data": fallback_bundles, "note": "Showing fallback recommendations due to API limits"}

from fastapi.staticfiles import StaticFiles

# ... existing routes ...

# Mount the current directory to serve index.html and assets
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # Use the PORT environment variable provided by Render
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Dealer Mitra Server on port {port}...")
    uvicorn.run("server:app", host="0.0.0.0", port=port)
