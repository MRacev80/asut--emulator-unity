using UnityEngine;
using UnityEngine.UI;
using UnityEditor;

public class SceneSetup : MonoBehaviour
{
    [MenuItem("Tools/1 - Clean Missing Scripts")]
    static void CleanMissingScripts()
    {
        var roots = UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects();
        int removed = 0;
        foreach (var go in roots)
            removed += CleanRecursive(go);

        UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(
            UnityEngine.SceneManagement.SceneManager.GetActiveScene());

        Debug.Log($"Removed {removed} missing scripts. Save scene (Ctrl+S).");
    }

    static int CleanRecursive(GameObject go)
    {
        int count = GameObjectUtility.RemoveMonoBehavioursWithMissingScript(go);
        foreach (Transform child in go.transform)
            count += CleanRecursive(child.gameObject);
        return count;
    }

    [MenuItem("Tools/2 - Setup ASUP Scene")]
    static void Setup()
    {
        // --- StatusText ---
        var statusGO = GameObject.Find("StatusText");
        if (statusGO == null) { Debug.LogError("StatusText not found"); return; }
        var statusText = statusGO.GetComponent<Text>() ?? statusGO.AddComponent<Text>();
        statusText.text = "Connecting...";
        statusText.color = Color.yellow;
        statusText.fontSize = 24;
        statusText.alignment = TextAnchor.MiddleCenter;
        var statusRect = statusGO.GetComponent<RectTransform>();
        statusRect.anchorMin = new Vector2(0.5f, 1f);
        statusRect.anchorMax = new Vector2(0.5f, 1f);
        statusRect.pivot = new Vector2(0.5f, 1f);
        statusRect.anchoredPosition = new Vector2(0, -40);
        statusRect.sizeDelta = new Vector2(600, 40);

        // --- CounterText ---
        var counterGO = GameObject.Find("CounterText");
        if (counterGO == null) { Debug.LogError("CounterText not found"); return; }
        var counterText = counterGO.GetComponent<Text>() ?? counterGO.AddComponent<Text>();
        counterText.text = "Count: --";
        counterText.color = Color.white;
        counterText.fontSize = 48;
        counterText.fontStyle = FontStyle.Bold;
        counterText.alignment = TextAnchor.MiddleCenter;
        var counterRect = counterGO.GetComponent<RectTransform>();
        counterRect.anchorMin = new Vector2(0.5f, 0.5f);
        counterRect.anchorMax = new Vector2(0.5f, 0.5f);
        counterRect.pivot = new Vector2(0.5f, 0.5f);
        counterRect.anchoredPosition = Vector2.zero;
        counterRect.sizeDelta = new Vector2(400, 80);

        // --- PLCBridge ---
        var bridgeGO = GameObject.Find("PLCBridge");
        if (bridgeGO == null) { Debug.LogError("PLCBridge not found"); return; }
        var bridge = bridgeGO.GetComponent<PLCBridge>() ?? bridgeGO.AddComponent<PLCBridge>();
        bridge.CounterText = counterText;
        bridge.StatusText = statusText;

        UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(
            UnityEngine.SceneManagement.SceneManager.GetActiveScene());

        Debug.Log("ASUP Scene ready! Save (Ctrl+S) then Play.");
    }
}
