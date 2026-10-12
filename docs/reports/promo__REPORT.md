# 宣传片交付说明
- promo-9x16.mp4：1080×1920，30fps，47.73 s，H.264 CRF20 veryfast + AAC 192k/48k，faststart，-14.0 LUFS，峰值 -2.3 dBFS
- promo-16x9.mp4：1920×1080，30fps，79.25 s，同上编码，-14.0 LUFS，峰值 -2.0 dBFS
- cover-9x16.png / cover-16x9.png；promo-prompt.md / .docx（5537 个汉字）
- 旁白：Piper TTS 离线中文音色 zh_CN-huayan-medium（rhasspy/piper-voices；该音色训练数据的商用授权我未核实，正式投放前请查看其 MODEL_CARD，或换用已授权的 TTS 重配；edge-tts 在本沙箱握手 403，无法使用）
- 音乐：music.py 用 numpy 原创合成（116 BPM，C 大调 I–V–vi–IV，钢琴+琶音+鼓点+pad），无第三方素材；侧链压低约 8.6 dB
- 素材：线上 154.8.183.93 实录截帧（首页、实验室 排序/页面置换/TCP 拥塞控制、整机拆解 3D、/pc?ride=access 11 站 + 结算卡 + 参数面板）
- QA：qa/contact-*-r1/r2.png，blackdetect 无黑场
