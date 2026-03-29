import torch
import os

def check_model(path):
    print(f"\n--- Checking '{path}' ---")
    if not os.path.exists(path):
        print("File not found.")
        return
        
    try:
        data = torch.load(path, map_location='cpu', weights_only=False)
        print(f"Type: {type(data)}")
        
        if isinstance(data, dict) and 'model_state_dict' in data:
            print("This looks like a CHECKPOINT with optimizer state.")
            state_dict = data['model_state_dict']
            print("Checkpoint keys:", list(data.keys()))
        elif isinstance(data, dict):
            print("This looks like a STATE_DICT (weights).")
            state_dict = data
        else:
            print(f"Unknown data type returned by load: {type(data)}")
            # Try to see if it's a ScriptModule
            try:
                has_forward = hasattr(data, 'forward')
                print(f"Is torch.jit.ScriptModule? {has_forward}")
                return
            except:
                pass
            return
            
        keys = list(state_dict.keys())
        print(f"Total keys: {len(keys)}")
        print("First 10 keys:")
        for k in keys[:10]:
            print("  -", k)
            
        # check if it's InceptionResnet
        is_inception = any('block' in k or 'mixed' in k or 'repeat' in k for k in keys)
        is_efficientnet = any('bn2' in k or 'conv_head' in k or 'blocks.' in k for k in keys)
        has_temporal = any('lstm' in k.lower() or 'rnn' in k.lower() or 'gru' in k.lower() or 'time' in k.lower() for k in keys)
        
        if is_inception and not has_temporal:
            print("=> Architecture: Frame-level Image Model (InceptionResnetV1 style)")
        elif is_efficientnet and not has_temporal:
            print("=> Architecture: Frame-level Image Model (EfficientNet style)")
        elif has_temporal:
            print("=> Architecture: Temporal Video Model (LSTM/RNN detected)")
        else:
            print("=> Architecture: Unknown structure")
            
    except Exception as e:
        print(f"Error loading: {e}")

check_model('models/best_model.pt')
check_model('checkpoint.pt')
check_model('models/deepfake_model_final.pt')
