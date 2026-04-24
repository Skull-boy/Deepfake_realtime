from huggingface_hub import HfApi, login
import os

print("=========================================")
print("HUGGING FACE AUTOMATIC UPLOADER")
print("=========================================")
print("1. Go to: https://huggingface.co/settings/tokens")
print("2. Click 'Create new token' (or use an existing one)")
print("3. IMPORTANT: Set the token type to 'WRITE' permissions!")
print("4. Copy the token.")
token = input("\nPaste your Hugging Face Token here: ").strip()

login(token=token)

api = HfApi()
repo_id = "pseudonomasorg/deepshield-ai"
repo_type = "space"

print("\n🚀 Uploading 'server' files to the Space root... (This may take a minute)")
api.upload_folder(
    folder_path="server",
    path_in_repo=".", # Puts main.py and requirements directly in the root
    repo_id=repo_id,
    repo_type=repo_type,
)

print("\n🚀 Uploading 'models' folder... (This will take a few minutes due to file size)")
api.upload_folder(
    folder_path="models",
    path_in_repo="models",
    repo_id=repo_id,
    repo_type=repo_type,
)

print("\n🚀 Generating and uploading Dockerfile...")
dockerfile_content = """FROM python:3.10-slim

# Install system dependencies required by OpenCV and PyTorch
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0

WORKDIR /app

# Copy requirements and install them
COPY requirements_server.txt .
RUN pip install --no-cache-dir -r requirements_server.txt

# Copy the rest of your code
COPY . .

# Run the FastAPI server on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
"""

with open("Dockerfile_hf", "w") as f:
    f.write(dockerfile_content)

api.upload_file(
    path_or_fileobj="Dockerfile_hf",
    path_in_repo="Dockerfile",
    repo_id=repo_id,
    repo_type=repo_type,
)

os.remove("Dockerfile_hf")

print("\n✅ Upload 100% Complete! Go check your Hugging Face Space.")
