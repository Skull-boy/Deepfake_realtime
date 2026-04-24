import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')
load_dotenv(env_path)

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI environment variable not set")

try:
    client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = client.get_database("deepfake")
    frame_records = db.get_collection("frame_records")
    
    docs = list(frame_records.find().sort('_id', -1).limit(1))
    if docs:
        print("Frame Record Example:")
        doc = docs[0]
        for k, v in doc.items():
            if k == 'embedding':
                print(f"  {k}: [Array of length {len(v)}]")
            else:
                print(f"  {k}: {v}")
    else:
        print("No Frame Records found.")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
