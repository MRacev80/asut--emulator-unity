#if UNITY_EDITOR
using UnityEngine;
using UnityEngine.UI;
using UnityEditor;

/// <summary>
/// Editor tool: Tools > Setup Traffic Light Scene
/// Adds traffic light circles and buttons to existing Canvas.
/// </summary>
public class TrafficLightSetup : EditorWindow
{
    [MenuItem("Tools/Setup Traffic Light Scene")]
    public static void SetupScene()
    {
        // Find existing Canvas
        Canvas canvas = Object.FindObjectOfType<Canvas>();
        if (canvas == null)
        {
            Debug.LogError("TrafficLightSetup: No Canvas found! Run 'Setup ASUP Scene' first.");
            return;
        }

        GameObject canvasGo = canvas.gameObject;

        // --- Traffic Light Container ---
        GameObject tlGo = new GameObject("TrafficLight");
        tlGo.transform.SetParent(canvasGo.transform, false);

        RectTransform tlRect = tlGo.AddComponent<RectTransform>();
        tlRect.anchoredPosition = new Vector2(-200, 0);
        tlRect.sizeDelta = new Vector2(120, 360);

        TrafficLight tl = tlGo.AddComponent<TrafficLight>();

        // --- Three circles ---
        Image redImg    = CreateCircle(tlGo, "RedLight",    Color.red,    new Vector2(0, 120));
        Image yellowImg = CreateCircle(tlGo, "YellowLight", Color.yellow, new Vector2(0, 0));
        Image greenImg  = CreateCircle(tlGo, "GreenLight",  Color.green,  new Vector2(0, -120));

        // Wire circles to TrafficLight component
        tl.RedLight    = redImg;
        tl.YellowLight = yellowImg;
        tl.GreenLight  = greenImg;

        // --- Reset Button ---
        Button resetBtn = CreateButton(canvasGo, "ResetButton", "Сброс", new Vector2(200, -100), Color.red);
        tl.ResetButton = resetBtn;

        // --- Enable/Stop Button ---
        Button enableBtn = CreateButton(canvasGo, "EnableButton", "Стоп", new Vector2(200, -160), new Color(0.2f, 0.7f, 0.2f));
        tl.EnableButton = enableBtn;

        // Get text component for enable button label
        Text enableText = enableBtn.GetComponentInChildren<Text>();
        tl.EnableButtonText = enableText;

        // Mark scene dirty
        UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(
            UnityEngine.SceneManagement.SceneManager.GetActiveScene());

        Debug.Log("TrafficLight: Scene setup complete! Save (Ctrl+S) then Play.");
    }

    static Image CreateCircle(GameObject parent, string name, Color color, Vector2 position)
    {
        GameObject go = new GameObject(name);
        go.transform.SetParent(parent.transform, false);

        RectTransform rt = go.AddComponent<RectTransform>();
        rt.anchoredPosition = position;
        rt.sizeDelta = new Vector2(80, 80);

        Image img = go.AddComponent<Image>();
        img.color = new Color(color.r, color.g, color.b, 0.2f); // start dimmed

        // Use Unity's built-in circle sprite
        img.sprite = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/Knob.psd");

        return img;
    }

    static Button CreateButton(GameObject parent, string name, string label, Vector2 position, Color color)
    {
        GameObject go = new GameObject(name);
        go.transform.SetParent(parent.transform, false);

        RectTransform rt = go.AddComponent<RectTransform>();
        rt.anchoredPosition = position;
        rt.sizeDelta = new Vector2(150, 40);

        Image img = go.AddComponent<Image>();
        img.color = color;

        Button btn = go.AddComponent<Button>();

        // Label
        GameObject labelGo = new GameObject("Label");
        labelGo.transform.SetParent(go.transform, false);

        RectTransform labelRt = labelGo.AddComponent<RectTransform>();
        labelRt.anchorMin = Vector2.zero;
        labelRt.anchorMax = Vector2.one;
        labelRt.offsetMin = Vector2.zero;
        labelRt.offsetMax = Vector2.zero;

        Text txt = labelGo.AddComponent<Text>();
        txt.text = label;
        txt.alignment = TextAnchor.MiddleCenter;
        txt.color = Color.white;
        txt.fontSize = 16;
        txt.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

        return btn;
    }
}
#endif
