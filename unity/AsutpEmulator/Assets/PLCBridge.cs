using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using NativeWebSocket;

/// <summary>
/// PLCBridge — connects Unity to Python Bridge via WebSocket.
/// Receives tag updates (JSON) and exposes values to UI components.
/// Sends write commands back to Python Bridge.
/// </summary>
public class PLCBridge : MonoBehaviour
{
    [Header("Connection")]
    public string BridgeUrl = "ws://localhost:8765";

    [Header("UI — assign in Inspector")]
    public Text CounterText;
    public Text StatusText;

    // Tag values accessible from other scripts
    public static Dictionary<string, object> Tags = new Dictionary<string, object>();
    public static bool IsConnected = false;

    private WebSocket _ws;

    async void Start()
    {
        _ws = new WebSocket(BridgeUrl);

        _ws.OnOpen += () =>
        {
            IsConnected = true;
            Debug.Log("PLCBridge: connected to " + BridgeUrl);
            SetStatus("Connected", Color.green);
        };

        _ws.OnClose += (code) =>
        {
            IsConnected = false;
            Debug.Log("PLCBridge: disconnected " + code);
            SetStatus("Disconnected", Color.red);
        };

        _ws.OnError += (err) =>
        {
            Debug.LogError("PLCBridge error: " + err);
            SetStatus("Error", Color.red);
        };

        _ws.OnMessage += (bytes) =>
        {
            var json = System.Text.Encoding.UTF8.GetString(bytes);
            ProcessMessage(json);
        };

        SetStatus("Connecting...", Color.yellow);
        await _ws.Connect();
    }

    void Update()
    {
#if !UNITY_WEBGL || UNITY_EDITOR
        _ws?.DispatchMessageQueue();
#endif
    }

    void ProcessMessage(string json)
    {
        try
        {
            var msg = JsonUtility.FromJson<WsMessage>(json);

            if (msg.type == "tag_update")
            {
                var update = JsonUtility.FromJson<TagUpdateMsg>(json);
                Tags[update.tag_id] = update.value;
                OnTagUpdate(update.tag_id, update.value);
            }
            else if (msg.type == "batch_update")
            {
                var batch = JsonUtility.FromJson<BatchUpdateMsg>(json);
                foreach (var item in batch.updates)
                {
                    Tags[item.tag_id] = item.value;
                    OnTagUpdate(item.tag_id, item.value);
                }
            }
            else if (msg.type == "initial_snapshot")
            {
                Debug.Log("PLCBridge: snapshot received");
            }
            else if (msg.type == "plc_status")
            {
                var status = JsonUtility.FromJson<PlcStatusMsg>(json);
                SetStatus(status.connected ? $"PLC OK ({status.mode})" : "PLC offline",
                          status.connected ? Color.green : Color.yellow);
            }
        }
        catch (Exception e)
        {
            Debug.LogWarning("PLCBridge parse error: " + e.Message + " | " + json);
        }
    }

    void OnTagUpdate(string tagId, object value)
    {
        if (tagId == "counter.count" && CounterText != null)
            CounterText.text = "Count: " + value;

        Debug.Log($"TAG {tagId} = {value}");
    }

    /// <summary>Send write command to Python Bridge (and then to CODESYS).</summary>
    public async void WriteTag(string tagId, object value)
    {
        if (_ws == null || _ws.State != WebSocketState.Open) return;

        var msg = new WriteTagMsg
        {
            type = "write_tag",
            request_id = Guid.NewGuid().ToString(),
            tag_id = tagId,
            value = value.ToString()
        };
        await _ws.SendText(JsonUtility.ToJson(msg));
        Debug.Log($"PLCBridge: write {tagId} = {value}");
    }

    void SetStatus(string text, Color color)
    {
        if (StatusText != null)
        {
            StatusText.text = text;
            StatusText.color = color;
        }
    }

    async void OnApplicationQuit()
    {
        if (_ws != null) await _ws.Close();
    }

    // --- JSON message types ---
    [Serializable] class WsMessage        { public string type; }
    [Serializable] class TagUpdateMsg     { public string type; public string tag_id; public string value; public float timestamp; }
    [Serializable] class TagUpdateItem    { public string tag_id; public string value; }
    [Serializable] class BatchUpdateMsg   { public string type; public List<TagUpdateItem> updates; }
    [Serializable] class PlcStatusMsg     { public string type; public bool connected; public string mode; }
    [Serializable] class WriteTagMsg      { public string type; public string request_id; public string tag_id; public string value; }
}
