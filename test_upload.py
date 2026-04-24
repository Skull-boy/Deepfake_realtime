import requests

url = "http://localhost:5000/api/upload"
file_path = r"c:\main\deepfake_main\my_videos\real\real01.mp4"

with open(file_path, "rb") as f:
    files = {"media": ("real01.mp4", f, "video/mp4")}
    response = requests.post(url, files=files)
    
print("Status Code:", response.status_code)
try:
    print("Response JSON:", response.json())
except Exception as e:
    print("Response Text:", response.text)
