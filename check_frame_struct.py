import os
import certifi
from pymongo import MongoClient

MONGO_URI = "mongodb+srv://psuedohacks:nothingphone2a128gb12gbram@cluster0.qs5ag9m.mongodb.net/deepfake?appName=Cluster0"

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
