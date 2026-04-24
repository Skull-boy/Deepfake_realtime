import os
import certifi
from pymongo import MongoClient

MONGO_URI = "mongodb+srv://psuedohacks:nothingphone2a128gb12gbram@cluster0.qs5ag9m.mongodb.net/deepfake?appName=Cluster0"

try:
    client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = client.get_database("deepfake")
    
    print("Collections:", db.list_collection_names())
    
    media_analysis = db.get_collection("mediaanalyses")
    frame_records = db.get_collection("frame_records")
    
    docs = list(media_analysis.find().sort('_id', -1).limit(1))
    if docs:
        doc = docs[0]
        print(f"Latest MediaAnalysis: ID={doc['_id']}")
        print(f"Status: {doc.get('status')}")
        print(f"Result: {doc.get('result')}")
        print(f"FileUrl: {doc.get('fileUrl')}")
    else:
        print("No MediaAnalysis documents found.")
        
    count = frame_records.count_documents({})
    print(f"\nTotal frame_records in DB: {count}")
    
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
