import os
import subprocess

# Create audio directory
audio_dir = "/Users/uchigasakigun/.gemini/antigravity/scratch/math-card-game/audio"
os.makedirs(audio_dir, exist_ok=True)

# Math terms and structures
parts = {
    "dai": "だい、",
    "mon": "、もん！",
    "plus": "、たす、",
    "minus": "、ひく、",
    "wa": "、わ、",
    "ikutsukana": "いくつかな？"
}

# Praise phrases
praise = [
    "わぁー！すごいっ！大正解！",
    "やったー！大正解！天才だね！",
    "せいかい！その調子、その調子！",
    "すばらしいっ！とってもかっこいいよ！",
    "大正解！すっごく上手だね！"
]

# Encourage phrases
encourage = [
    "あちゃー、おしいっ！次はきっとできるよ！",
    "大丈夫、大丈夫！次は絶対いけるよ！",
    "あきらめないで！もう一回やってみよう！",
    "おしいっ！もうちょっとだったね！"
]

def generate_voice(text, filename):
    filepath = os.path.join(audio_dir, filename)
    print(f"Generating: {filename} -> '{text}'")
    # Using macOS native 'say' command with Kyoko voice to output a standard WAVE format
    cmd = ["say", "-v", "Kyoko", text, "-o", filepath, "--file-format=WAVE", "--data-format=LEI16@22050"]
    subprocess.run(cmd)

# Generate structures
for name, text in parts.items():
    generate_voice(text, f"{name}.wav")

# Generate praise
for i, text in enumerate(praise):
    generate_voice(text, f"praise_{i}.wav")

# Generate encourage
for i, text in enumerate(encourage):
    generate_voice(text, f"encourage_{i}.wav")

# Generate numbers 0 to 99
for n in range(100):
    generate_voice(str(n), f"num_{n}.wav")

# Also generate "こたえはね..." and "だよ！"
generate_voice("こたえわね、、、", "kotaewane.wav")
generate_voice("、だよ！", "dayo.wav")

# Generate results fanfares
generate_voice("わぁー！すごーい！かんぺき！全問正解、おめでとう！", "result_10.wav")
generate_voice("やったね！たいへんよくできました！", "result_8.wav")
generate_voice("よくがんばったね！その調子だよ！", "result_5.wav")
generate_voice("最後まであきらめずにがんばって、とってもえらいね！次もがんばろう！", "result_low.wav")

print("All audio files generated successfully!")
