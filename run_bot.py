#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "httpx>=0.25.0",
#     "qrcode[pil]>=7.4.2",
# ]
# ///
"""
WeChat ClawBot + DeepSeek MVP
纯本地运行的极简微信个人号（iLink 协议）AI 对话服务，无需 OpenClaw Gateway。
"""

import os
import sys
import time
import json
import uuid
import random
import base64
import signal
import logging
from typing import Dict, List, Any, Optional
from collections import defaultdict, deque

import httpx
import qrcode

# 基础配置
ILINK_BASE_URL = "https://ilinkai.weixin.qq.com"
SESSION_FILE = ".wechat_session.json"
ENV_FILE = ".env"

# 日志输出配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("wechat-deepseek")


def load_env(env_path: str = ENV_FILE) -> None:
    """加载本地 .env 文件中的环境变量（若存在）"""
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip("'\"")
            if k and k not in os.environ:
                os.environ[k] = v


def make_headers(bot_token: Optional[str] = None) -> Dict[str, str]:
    """生成腾讯 iLink 协议所需的基础请求头"""
    uin_int = random.randint(100000000, 999999999)
    uin_b64 = base64.b64encode(str(uin_int).encode()).decode()
    headers = {
        "Content-Type": "application/json",
        "X-WECHAT-UIN": uin_b64,
        "iLink-App-ClientVersion": "1",
    }
    if bot_token:
        headers["AuthorizationType"] = "ilink_bot_token"
        headers["Authorization"] = f"Bearer {bot_token}"
    return headers


class WeChatClient:
    def __init__(self, session_path: str = SESSION_FILE):
        self.session_path = session_path
        self.bot_token: Optional[str] = None
        self.updates_buf: str = ""
        self.bot_id: str = ""
        self.load_session()

    def load_session(self) -> None:
        """从本地文件恢复会话"""
        if os.path.exists(self.session_path):
            try:
                with open(self.session_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.bot_token = data.get("bot_token")
                    self.updates_buf = data.get("updates_buf", "")
                    self.bot_id = data.get("bot_id", "")
                    if self.bot_token:
                        logger.info("已加载本地持久化会话凭证")
            except Exception as e:
                logger.warning(f"读取本地凭证失败: {e}")

    def save_session(self) -> None:
        """保存会话至本地文件"""
        data = {
            "bot_token": self.bot_token,
            "updates_buf": self.updates_buf,
            "bot_id": self.bot_id,
        }
        with open(self.session_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def clear_session(self) -> None:
        """清除失效凭证"""
        self.bot_token = None
        self.updates_buf = ""
        self.bot_id = ""
        if os.path.exists(self.session_path):
            try:
                os.remove(self.session_path)
            except OSError:
                pass

    def login_with_qrcode(self) -> None:
        """获取二维码并在终端打印，轮询直到用户扫码确认"""
        with httpx.Client(timeout=45.0) as client:
            logger.info("正在向微信申请登录二维码...")
            resp = client.get(
                f"{ILINK_BASE_URL}/ilink/bot/get_bot_qrcode",
                params={"bot_type": 3},
                headers=make_headers(),
            )
            resp.raise_for_status()
            qr_data = resp.json()

            if qr_data.get("ret") != 0:
                raise RuntimeError(f"获取二维码失败: {qr_data}")

            qrcode_key = qr_data["qrcode"]
            qr_content = qr_data["qrcode_img_content"]

            print("\n" + "=" * 50)
            print("请使用已开通 ClawBot 插件的微信扫描下方二维码：")
            print("=" * 50)

            # 终端打印 ASCII 二维码
            qr = qrcode.QRCode(border=1)
            qr.add_data(qr_content)
            qr.print_ascii(invert=True)

            # 导出图片作为备用
            try:
                img = qr.make_image()
                img.save("qrcode.png")
                print("二维码已同时另存为本地图片: qrcode.png")
            except Exception as e:
                logger.debug(f"保存 qrcode.png 失败: {e}")

            print(f"二维码链接: {qr_content}\n")
            print("等待手机微信确认登录...")

            # 轮询扫码状态
            while True:
                try:
                    status_resp = client.get(
                        f"{ILINK_BASE_URL}/ilink/bot/get_qrcode_status",
                        params={"qrcode": qrcode_key},
                        headers=make_headers(),
                        timeout=45.0,
                    )
                    status_data = status_resp.json()
                    status = status_data.get("status")

                    if status == "wait":
                        time.sleep(1)
                        continue
                    elif status == "scaned":
                        logger.info("微信已扫码，请在手机上点击「确认登录」...")
                        time.sleep(1)
                        continue
                    elif status == "confirmed":
                        self.bot_token = status_data.get("bot_token")
                        self.bot_id = status_data.get("ilink_bot_id", "")
                        self.save_session()
                        logger.info("🎉 微信扫码登录成功！")
                        break
                    elif status == "expired":
                        logger.warning("二维码已过期，重新获取中...")
                        return self.login_with_qrcode()
                    else:
                        logger.warning(f"未知登录状态: {status_data}")
                        time.sleep(2)
                except httpx.ReadTimeout:
                    continue
                except Exception as e:
                    logger.warning(f"轮询状态网络异常: {e}，重试中...")
                    time.sleep(2)

    def get_updates(self, client: httpx.Client) -> List[Dict[str, Any]]:
        """长轮询获取微信端新消息"""
        if not self.bot_token:
            return []

        payload = {"get_updates_buf": self.updates_buf}
        try:
            resp = client.post(
                f"{ILINK_BASE_URL}/ilink/bot/getupdates",
                headers=make_headers(self.bot_token),
                json=payload,
                timeout=45.0,
            )
            if resp.status_code == 401 or resp.status_code == 403:
                logger.warning("凭证被拒绝，需要重新登录")
                self.clear_session()
                return []

            data = resp.json()
            ret = data.get("ret", 0)
            if ret != 0:
                logger.warning(f"getupdates 接口返回错误 ret={ret}, errmsg={data.get('errmsg')}")
                if ret in (-14, -2, -1):  # 常见 token 失效错误码
                    self.clear_session()
                return []

            # 更新同步游标并保存
            new_buf = data.get("get_updates_buf")
            if new_buf:
                self.updates_buf = new_buf
                self.save_session()

            return data.get("msgs", [])
        except httpx.ReadTimeout:
            return []
        except Exception as e:
            logger.warning(f"长轮询请求异常: {e}")
            time.sleep(2)
            return []

    def send_message(self, client: httpx.Client, to_user_id: str, context_token: str, text: str) -> bool:
        """回发文本消息至微信会话"""
        payload = {
            "msg": {
                "from_user_id": "",
                "to_user_id": to_user_id,
                "client_id": str(uuid.uuid4()),
                "message_type": 2,
                "message_state": 2,
                "context_token": context_token,
                "item_list": [
                    {
                        "type": 1,
                        "text_item": {
                            "text": text
                        }
                    }
                ],
            },
            "base_info": {
                "channel": 0
            }
        }
        try:
            resp = client.post(
                f"{ILINK_BASE_URL}/ilink/bot/sendmessage",
                headers=make_headers(self.bot_token),
                json=payload,
                timeout=15.0,
            )
            data = resp.json()
            if data.get("ret") == 0:
                logger.info(f"已成功回复微信消息 (to: {to_user_id[:8]}...): {text[:30]}...")
                return True
            else:
                logger.error(f"消息回复失败: {data}")
                return False
        except Exception as e:
            logger.error(f"发送消息网络异常: {e}")
            return False


class DeepSeekBot:
    def __init__(self, api_key: str, base_url: str = "https://api.deepseek.com", model: str = "deepseek-chat"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        # 内存滑动窗口上下文：user_id -> deque([{"role": ..., "content": ...}], maxlen=6)
        self.histories: Dict[str, deque] = defaultdict(lambda: deque(maxlen=6))

    def reset_user(self, user_id: str) -> None:
        """重置指定用户的上下文"""
        if user_id in self.histories:
            self.histories[user_id].clear()

    def chat(self, user_id: str, user_prompt: str) -> str:
        """调用 DeepSeek 接口获取回复"""
        history = self.histories[user_id]
        messages = [{"role": "system", "content": "你是运行在微信里的智能助手，由 DeepSeek 提供强大支持。回答简明得体、排版易于微信移动端阅读。"}]
        messages.extend(list(history))
        messages.append({"role": "user", "content": user_prompt})

        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": 0.7,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                reply = data["choices"][0]["message"]["content"].strip()

                # 更新历史窗口
                history.append({"role": "user", "content": user_prompt})
                history.append({"role": "assistant", "content": reply})
                return reply
        except httpx.HTTPStatusError as e:
            logger.error(f"DeepSeek API 状态错误: {e.response.status_code} - {e.response.text}")
            return f"⚠️ 调用 DeepSeek API 异常 ({e.response.status_code})，请检查 API Key 或稍后重试。"
        except Exception as e:
            logger.error(f"DeepSeek API 请求异常: {e}")
            return "⚠️ 抱歉，当前处理回复超时或发生网络异常，请重试。"


def main():
    load_env()
    api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        print("\n" + "=" * 60)
        print("【提示】未检测到 DEEPSEEK_API_KEY 环境变量！")
        print("请在当前目录创建 .env 文件，并填入：")
        print("DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx")
        print("或在运行前执行: export DEEPSEEK_API_KEY=sk-xxxx")
        print("=" * 60 + "\n")
        sys.exit(1)

    base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()
    model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat").strip()

    deepseek = DeepSeekBot(api_key=api_key, base_url=base_url, model=model)
    wechat = WeChatClient()

    # 退出信号捕获
    def signal_handler(sig, frame):
        print("\n正在停止服务...")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print("=" * 60)
    print("🚀 WeChat ClawBot + DeepSeek 本地服务启动中")
    print(f"• 模型引擎: {model} ({base_url})")
    print("• 支持命令: 发送 /reset 或 /clear 可清空上下文记忆")
    print("=" * 60)

    # 如果没有 token 或 token 已失效，进入扫码
    if not wechat.bot_token:
        wechat.login_with_qrcode()

    seen_msg_ids = set()

    with httpx.Client(timeout=45.0) as client:
        # 先试探轮询一次，验证已有凭证是否有效
        logger.info("正在验证微信通道会话连接...")
        while True:
            if not wechat.bot_token:
                logger.info("凭证失效或不存在，准备重新扫码登录...")
                wechat.login_with_qrcode()

            msgs = wechat.get_updates(client)
            if not wechat.bot_token:
                # 说明在 get_updates 中遇到 token 失效
                continue

            for msg in msgs:
                msg_id = msg.get("message_id") or str(msg.get("seq"))
                if msg_id and msg_id in seen_msg_ids:
                    continue
                if msg_id:
                    seen_msg_ids.add(msg_id)
                    if len(seen_msg_ids) > 1000:
                        seen_msg_ids.pop()

                from_user = msg.get("from_user_id", "")
                context_token = msg.get("context_token", "")
                item_list = msg.get("item_list", [])

                if not from_user or not context_token:
                    continue

                # 提取文本消息
                user_text = None
                for item in item_list:
                    if item.get("type") == 1:
                        user_text = item.get("text_item", {}).get("text", "")
                        break

                if user_text is not None:
                    user_text = user_text.strip()
                    logger.info(f"收到用户 [{from_user[:8]}...] 消息: {user_text}")

                    if user_text in ("/reset", "/clear"):
                        deepseek.reset_user(from_user)
                        wechat.send_message(client, from_user, context_token, "🧹 会话记忆已重置，我们可以重新开始！")
                    else:
                        reply = deepseek.chat(from_user, user_text)
                        wechat.send_message(client, from_user, context_token, reply)
                else:
                    logger.info(f"收到用户 [{from_user[:8]}...] 非文本消息")
                    wechat.send_message(
                        client,
                        from_user,
                        context_token,
                        "🤖 收到您的非文本消息，当前仅支持纯文本交互哦~"
                    )

            time.sleep(0.5)


if __name__ == "__main__":
    main()
